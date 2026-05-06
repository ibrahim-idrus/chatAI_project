# Async Chat via Cloudflare Durable Objects

## TL;DR

> **Quick Summary**: Replace synchronous `/api/chat/stream` with an async architecture using Cloudflare Durable Objects (one per thread) + WebSocket Hibernation for real-time streaming + unified queue for both initial requests and retries.
> 
> **Deliverables**:
> - `apps/backend/src/durable-objects/ChatThreadDO.ts` — Durable Object per thread with WebSocket + streaming AI
> - `apps/backend/src/lib/chat-queue.ts` — Unified queue handler (replaces `retry.ts`)
> - `apps/frontend/src/lib/chat-ws.ts` — WebSocket client for DO communication
> - `apps/frontend/src/hooks/useChatWebSocket.ts` — React hook wrapping WebSocket
> - Updated `apps/backend/src/index.ts` — DO + queue bindings
> - Updated `apps/backend/wrangler.toml` — DO + queue config
> - Updated `apps/frontend/src/routes/_auth/chat.tsx` — WebSocket-based chat UI
> - TDD test files for DO, queue consumer, and WebSocket client
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: T1 → T3 → T6 → T7 → T10 → T12 → F1-F4

---

## Context

### Original Request
"I need help improving the implementation of this project. Currently the chat operation is still a sync operation. I want to make it async by utilizing cloudflare Durable object. So when a message is sent, it directly hands over an execution of the chat to a queue. Once the handler of the queue finishes, it will update the chat data in db and the FE will update its chat"

### Interview Summary
**Key Discussions**:
- **Streaming**: User wants token-by-token streaming DO → FE (not batch)
- **FE communication**: WebSocket with DO
- **Scope**: Full async overhaul — chat + retry pipeline unified into single queue with `retry: number` field
- **DO identity**: One DO per thread (long-lived)
- **Concurrency**: Sequential processing (DO single-threaded, natural queuing)
- **Migration**: Replace `/api/chat/stream` entirely, no coexistence period
- **Tests**: TDD (Red-Green-Refactor)
- **Branch**: Create new branch `feat/async-chat-durable-objects` for implementation

**Research Findings**:
- Current sync flow: POST `/api/chat/stream` → `streamAIResponse()` → `toTextStreamResponse()` → FE reads ReadableStream
- Current retry: CHAT_RETRY_QUEUE → `handleRetry()` → non-streaming `generateText`
- DO patterns: WebSocket Hibernation API, SQLite-backed storage, blockConcurrencyWhile for init
- Reference: cloudflare/workers-chat-demo (1089 stars) for DO + WebSocket pattern

### Metis Review
Metis ran 5 parallel agents (auth, frontend, schema, chat flow, librarian) and identified 10 critical findings. Key findings incorporated:

| # | Finding | Decision |
|---|---------|----------|
| 1 | Auth middleware must be extracted for DO reuse | Extract `validateSession(token, env)` from `authMiddleware` — reusable by Hono and DO |
| 2 | No WebSocket protocol defined — contract missing | Define Zod schemas for all message types (T5 already covers) |
| 3 | DO vs Postgres data ownership ambiguous | **Postgres primary** — DO SQLite is read-through performance cache |
| 4 | Queue consumer relay vs direct OpenAI calls unclear | **Fat consumer** — consumer calls OpenAI directly, forwards tokens to DO via RPC, DO broadcasts |
| 5 | `useMessageStatus.ts` polls every 3s — replaceable | Delete it — WebSocket push replaces polling entirely |
| 6 | Frontend ID mismatch (optimistic vs real DB IDs) | DO sends `{ type: "metadata", dbMessageId }` on first token |
| 7 | `chat.tsx` is 467-line monolith | Refactor into components before WebSocket migration |
| 8 | `useThreadChat.ts` orphaned, incompatible | Delete it |
| 9 | No alarm-based OpenAI timeout | DO sets 60s alarm; abort on timeout |
| 10 | Session invalidation mid-connection undetected | Periodic KV re-check every 5 minutes; close with code 4001

---

## Work Objectives

### Core Objective
Replace synchronous AI chat streaming with an async Durable Object architecture that provides real-time token streaming via WebSocket, unified queue processing for both initial requests and retries, and maintains all existing DB consistency guarantees.

### Concrete Deliverables
- Durable Object class `ChatThreadDO` with WebSocket Hibernation + AI streaming
- Unified queue consumer handling both initial chat and retry (via `retry` field)
- Frontend WebSocket client + React hook replacing ReadableStream pattern
- Updated wrangler.toml with DO + queue bindings
- TDD test suite for all new components
- Removal of old sync route (`chat.ts`) and old retry handler (`retry.ts`)

### Definition of Done
- [ ] `npm run build` passes (all packages + apps)
- [ ] `npm run lint` passes
- [ ] `npm run build -w @chatai/frontend` passes (tsc + vite)
- [ ] All TDD tests pass
- [ ] Agent QA: WebSocket connects, sends message, receives streaming tokens, DB updated correctly
- [ ] Agent QA: Retry flow works (simulated error → requeue → success)
- [ ] Agent QA: Multiple WebSocket clients for same thread receive same updates
- [ ] Old sync route and retry handler fully removed

### Must Have
- DO per thread with WebSocket Hibernation
- Unified queue with `retry: number` field (0 = initial, 1+ = retry)
- Token-by-token streaming to frontend via WebSocket
- DB consistency: messages.status transitions (pending → completed/failed)
- token_usage and threads.totalTokens updated correctly
- Indonesian error messages (match existing convention)
- Three-layer auth preserved (JWT cookie + KV + DB sessions)

### Must NOT Have (Guardrails)
- No changes to DB schema (use existing messages, token_usage, threads tables)
- No changes to auth model (JWT, KV, sessions table untouched)
- No changes to profile, history, or login routes
- No `as any`, `@ts-ignore`, or empty catch blocks
- No leftover references to old `streamAIResponse` or `handleRetry`
- No sync `/api/chat/stream` endpoint remaining
- No AI slop: excessive comments, over-abstraction, generic variable names

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: TDD (Red-Green-Refactor)
- **Framework**: bun test (existing)
- **If TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.

- **Frontend/UI**: Playwright — WebSocket connection, message sending, streaming display
- **API/Backend**: curl + tmux — WebSocket upgrade, queue publishing, DB state verification
- **Library/Module**: bun test — unit tests for DO logic, queue payload parsing, WebSocket protocol

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — branch + types + config + test scaffolding):
├── T1: Create feature branch [quick]
├── T2: Unified queue payload types + Zod schemas [quick]
├── T3: Wrangler config — DO + queue bindings [quick]
├── T4: ChatThreadDO skeleton + test scaffold [quick]
├── T5: WebSocket protocol types + test scaffold [quick]
├── T6: Extract auth validation to standalone function [quick]
├── T7: Delete orphaned hooks (useThreadChat, useMessageStatus) [quick]
├── T8: Refactor chat.tsx into modular components [visual-engineering]
└── T9: Frontend WebSocket client stub + test scaffold [quick]

Wave 2 (After Wave 1 — core backend logic):
├── T10: ChatThreadDO — constructor + storage init + WebSocket accept [deep]
├── T11: ChatThreadDO — RPC handler for consumer relay + periodic KV check [deep]
├── T12: ChatThreadDO — WebSocket broadcast + token streaming [deep]
├── T13: Fat queue consumer — OpenAI calls + DB writes (replaces retry.ts) [unspecified-high]
├── T14: Worker entry — wire DO + queue + remove old route [quick]
└── T15: Remove old sync route + retry handler [quick]

Wave 3 (After Wave 2 — frontend integration):
├── T16: Frontend WebSocket client implementation [unspecified-high]
├── T17: useChatWebSocket React hook [visual-engineering]
├── T18: Update chat.tsx — replace ReadableStream with WebSocket [visual-engineering]
└── T19: Error handling + reconnect logic + queued indicator [visual-engineering]

Wave 4 (After Wave 3 — TDD tests + verification):
├── T20: TDD — ChatThreadDO unit tests [deep]
├── T21: TDD — Fat queue consumer unit tests [unspecified-high]
├── T22: TDD — WebSocket client integration tests [unspecified-high]
└── T23: Full build + lint + typecheck verification [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high + playwright)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

- **T1**: None — T2-T9
- **T2**: None — T4, T11, T13
- **T3**: None — T4, T10, T14
- **T4**: T2, T3 — T10, T20
- **T5**: None — T10, T12, T16
- **T6**: None — T10 (auth validation reused by DO)
- **T7**: None — T23 (just file deletion)
- **T8**: None — T18 (components used by migrated chat.tsx)
- **T9**: T5 — T16, T22
- **T10**: T3, T4, T5, T6 — T11, T12
- **T11**: T2, T10 — T13, T20
- **T12**: T5, T10 — T16, T18, T20
- **T13**: T2, T11 — T23
- **T14**: T3, T10 — T15, T23
- **T15**: T14 — T23
- **T16**: T5, T9, T12 — T17, T22
- **T17**: T16 — T18, T19
- **T18**: T8, T12, T17 — T19
- **T19**: T17, T18 — T23
- **T20**: T11, T12 — T23
- **T21**: T13 — T23
- **T22**: T16 — T23
- **T23**: T13, T14, T15, T19, T20, T21, T22 — F1-F4

### Agent Dispatch Summary

- **Wave 1**: **9** — T1-T5 → `quick`, T6-T7 → `quick`, T8 → `visual-engineering`, T9 → `quick`
- **Wave 2**: **6** — T10-T12 → `deep`, T13 → `unspecified-high`, T14-T15 → `quick`
- **Wave 3**: **4** — T16 → `unspecified-high`, T17-T19 → `visual-engineering`
- **Wave 4**: **4** — T20 → `deep`, T21-T22 → `unspecified-high`, T23 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [x] T1. Create feature branch `feat/async-chat-durable-objects`

  **What to do**:
  - `git checkout -b feat/async-chat-durable-objects`
  - Verify branch active and working tree clean

  **Must NOT do**: No code changes

  **Recommended Agent Profile**:
  - **Category**: `quick` — single git command
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1 (T1-T6)
  - **Blocks**: All subsequent tasks
  - **Blocked By**: None

  **References**: Repo root `/Users/ali/projects/paragentix/chatAI_project`

  **Acceptance Criteria**:
  - [ ] `git branch --show-current` returns `feat/async-chat-durable-objects`

  **QA Scenarios**:
  ```
  Scenario: Branch created and active
    Tool: Bash (git)
    Steps:
      1. git checkout -b feat/async-chat-durable-objects
      2. git branch --show-current
    Expected Result: Output is "feat/async-chat-durable-objects"
    Evidence: .sisyphus/evidence/task-T1-branch.txt
  ```

  **Commit**: NO (grouped with T11)

- [x] T2. Unified queue payload types + Zod schemas in `@chatai/types`

  **What to do**:
  - Add to `packages/types/src/index.ts`:
    - `chatQueuePayloadSchema` — Zod: `{ threadId: z.string(), userId: z.string(), messageId: z.string(), messages: z.array(z.object({ role: z.enum(['user','assistant']), content: z.string() })), retry: z.number().int().min(0).default(0) }`
    - Export `ChatQueuePayload` via `z.infer`
  - Write failing test first (TDD), then implement

  **Must NOT do**: No changes to existing auth schemas, no queue handler impl

  **Recommended Agent Profile**:
  - **Category**: `quick` — type definition, small scope
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1 (T1-T6)
  - **Blocks**: T4, T8, T10
  - **Blocked By**: None

  **References**:
  - `packages/types/src/index.ts` — existing Zod schemas, follow same export pattern
  - `apps/backend/src/lib/retry.ts` — current `RetryPayload` type (to be replaced)

  **Acceptance Criteria**:
  - [ ] Test file exists and passes: `bun test packages/types/src/__tests__/chat-queue.test.ts`
  - [ ] Schema validates payload with retry=0 and retry=3
  - [ ] Schema rejects payload missing threadId or with negative retry

  **QA Scenarios**:
  ```
  Scenario: Valid payload passes schema validation
    Tool: Bash (bun test)
    Steps: 1. bun test packages/types/src/__tests__/chat-queue.test.ts
    Expected Result: All tests pass, 0 failures
    Evidence: .sisyphus/evidence/task-T2-schema-valid.txt

  Scenario: Invalid payload (missing threadId) rejected
    Tool: Bash (bun test)
    Steps: 1. bun test packages/types/src/__tests__/chat-queue.test.ts -t "rejects missing"
    Expected Result: Test confirms ZodError thrown
    Evidence: .sisyphus/evidence/task-T2-schema-invalid.txt
  ```

  **Commit**: NO (grouped with T11)

- [x] T3. Wrangler config — DO + queue bindings + env types

  **What to do**:
  - Edit `apps/backend/wrangler.toml`:
    - `[[durable_objects.bindings]]` — name `CHAT_THREAD_DO`, class_name `ChatThreadDO`
    - `[[migrations]]` — new_classes for `ChatThreadDO`
    - `[[queues.producers]]` — queue `chat-queue`, binding `CHAT_QUEUE`
    - `[[queues.consumers]]` — queue `chat-queue`, max_batch_size=10, max_retries=3, max_timeout=30
  - Edit `apps/backend/src/env.ts` — add typed bindings for `CHAT_THREAD_DO` (DurableObjectNamespace) and `CHAT_QUEUE` (Queue<ChatQueuePayload>)

  **Must NOT do**: No changes to KV, AI, SESSION_KV bindings; no DO class impl yet

  **Recommended Agent Profile**:
  - **Category**: `quick` — config file updates with known schema
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1 (T1-T6)
  - **Blocks**: T4, T7, T11
  - **Blocked By**: None

  **References**:
  - `apps/backend/wrangler.toml` — existing bindings structure
  - `apps/backend/src/env.ts` — typed env interface

  **Acceptance Criteria**:
  - [ ] `wrangler.toml` has `[[durable_objects.bindings]]` with `CHAT_THREAD_DO`
  - [ ] `wrangler.toml` has `[[queues.producers]]` and `[[queues.consumers]]` for `chat-queue`
  - [ ] `apps/backend/src/env.ts` includes `CHAT_THREAD_DO` and `CHAT_QUEUE` types
  - [ ] `npx wrangler deploy --dry-run -c apps/backend/wrangler.toml` exits 0

  **QA Scenarios**:
  ```
  Scenario: Wrangler config validates
    Tool: Bash (wrangler)
    Steps: 1. npx wrangler deploy --dry-run -c apps/backend/wrangler.toml
    Expected Result: Exit code 0, no errors
    Evidence: .sisyphus/evidence/task-T3-wrangler.txt
  ```

  **Commit**: NO (grouped with T11)

- [x] T4. ChatThreadDO skeleton + directory structure

  **What to do**:
  - Create `apps/backend/src/durable-objects/ChatThreadDO.ts`:
    - Class `ChatThreadDO` with constructor(state: DurableObjectState, env: Env)
    - Empty `fetch(request)` returning 404
    - Empty `alarm()` stub
    - Export default
  - Create `apps/backend/src/durable-objects/index.ts` barrel export
  - Write failing test scaffold (TDD)

  **Must NOT do**: No WebSocket logic (T7), no AI streaming (T8), no storage ops

  **Recommended Agent Profile**:
  - **Category**: `quick` — scaffolding, empty class structure
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1 (T1-T6)
  - **Blocks**: T7, T17
  - **Blocked By**: None (independent of T2, T3 — just needs directory)

  **References**:
  - CF DO base class: https://developers.cloudflare.com/durable-objects/api/base
  - `apps/backend/src/index.ts` — current worker entry

  **Acceptance Criteria**:
  - [ ] File exists: `apps/backend/src/durable-objects/ChatThreadDO.ts`
  - [ ] File exists: `apps/backend/src/durable-objects/index.ts`
  - [ ] `ChatThreadDO` class exported with constructor, fetch, alarm stubs
  - [ ] `npx tsc --noEmit -p apps/backend/tsconfig.json` passes

  **QA Scenarios**:
  ```
  Scenario: DO skeleton compiles without errors
    Tool: Bash (tsc)
    Steps: 1. npx tsc --noEmit -p apps/backend/tsconfig.json
    Expected Result: Exit code 0, no type errors
    Evidence: .sisyphus/evidence/task-T4-compile.txt
  ```

  **Commit**: NO (grouped with T11)

- [x] T5. WebSocket protocol types + message format

  **What to do**:
  - Create `apps/backend/src/lib/ws-protocol.ts`:
    - `wsClientMessageSchema` — union: `{ type: 'send_message', threadId, content }` | `{ type: 'ping' }`
    - `wsServerMessageSchema` — union: `{ type: 'token', content }` | `{ type: 'done', messageId, tokenCount }` | `{ type: 'error', message }` | `{ type: 'pong' }` | `{ type: 'status', status }`
    - Export types via `z.infer`
    - Helpers: `parseWsClientMessage(data: string)`, `serializeWsServerMessage(msg)`
  - Write failing tests first (TDD)

  **Must NOT do**: No WebSocket connection handling (T7/T9), no frontend impl

  **Recommended Agent Profile**:
  - **Category**: `quick` — type definitions + parse helpers
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1 (T1-T6)
  - **Blocks**: T7, T9, T13
  - **Blocked By**: None

  **References**:
  - `packages/types/src/index.ts` — Zod schema patterns
  - CF WebSocket docs: https://developers.cloudflare.com/durable-objects/api/websockets

  **Acceptance Criteria**:
  - [ ] Test file exists and passes for ws-protocol
  - [ ] `parseWsClientMessage` correctly parses valid JSON, throws on invalid
  - [ ] `serializeWsServerMessage` produces valid JSON strings

  **QA Scenarios**:
  ```
  Scenario: Parse valid client message
    Tool: Bash (bun test)
    Steps: 1. bun test apps/backend/src/lib/__tests__/ws-protocol.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-T5-protocol.txt
  ```

  **Commit**: NO (grouped with T14)

- [x] T6. Extract auth validation to standalone function

  **What to do**:
  - Create `apps/backend/src/lib/session.ts`:
    - Export `validateSession(token: string, env: Env): Promise<{ userId: string, role: string, sessionId: string } | null>`
    - Verify JWT via `jose.jwtVerify(token, env.JWT_SECRET)`
    - Check KV: `await env.SESSION_KV.get(sessionId)` — return null if missing
    - Check DB: verify session hash exists in `sessions` table
    - Return `{ userId, role, sessionId }` on success, `null` on any failure
  - Update `apps/backend/src/middleware/auth.ts`:
    - Replace inline validation with `validateSession(getCookie(c, 'token'), c.env)`
    - Preserve ALL existing error messages and HTTP status codes
    - Preserve `c.set('userId', ...)` and `c.set('role', ...)` calls
  - Write failing tests first (TDD)

  **Must NOT do**: No logic changes — extraction only. Same JWT, KV, DB checks in same order.

  **Recommended Agent Profile**:
  - **Category**: `quick` — extraction refactor, no logic changes
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1
  - **Blocks**: T10 (DO uses validateSession for WebSocket auth)
  - **Blocked By**: None

  **References**:
  - `apps/backend/src/middleware/auth.ts` — full authMiddleware implementation
  - `apps/backend/src/env.ts` — Env type with JWT_SECRET, SESSION_KV, DB bindings

  **Acceptance Criteria**:
  - [ ] `validateSession(validToken, env)` returns `{ userId, role, sessionId }`
  - [ ] `validateSession(invalidToken, env)` returns `null`
  - [ ] `validateSession(validToken, env)` returns `null` when KV session deleted
  - [ ] All existing auth route tests still pass
  - [ ] `bun test apps/backend/src/lib/__tests__/session.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Valid session returns user data
    Tool: Bash (bun test)
    Steps: 1. bun test apps/backend/src/lib/__tests__/session.test.ts -t "valid session"
    Expected Result: Returns { userId, role, sessionId }
    Evidence: .sisyphus/evidence/task-T6-valid.txt

  Scenario: Expired KV session returns null
    Tool: Bash (bun test)
    Steps: 1. bun test apps/backend/src/lib/__tests__/session.test.ts -t "expired session"
    Expected Result: Returns null
    Evidence: .sisyphus/evidence/task-T6-expired.txt
  ```

  **Commit**: NO (grouped with T14)

- [x] T7. Delete orphaned hooks (useThreadChat.ts, useMessageStatus.ts)

  **What to do**:
  - Delete `apps/frontend/src/hooks/useThreadChat.ts` (orphaned, uses `@ai-sdk/react`, incompatible with WebSocket)
  - Delete `apps/frontend/src/hooks/useMessageStatus.ts` (polls /api/messages/{id}/status every 3s — replaced by WebSocket push)
  - Remove any imports of deleted files
  - Remove `@ai-sdk/react` from `apps/frontend/package.json` if no other consumers exist
  - Verify build passes after deletion

  **Must NOT do**: No changes to `_auth/chat.tsx` (that's T8+T18)

  **Recommended Agent Profile**:
  - **Category**: `quick` — file deletion + import cleanup
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1
  - **Blocks**: T23 (build verification)
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/hooks/useThreadChat.ts` — to delete
  - `apps/frontend/src/hooks/useMessageStatus.ts` — to delete
  - `apps/frontend/package.json` — check for @ai-sdk/react dependency

  **Acceptance Criteria**:
  - [ ] `useThreadChat.ts` deleted
  - [ ] `useMessageStatus.ts` deleted
  - [ ] No imports of deleted files remain
  - [ ] `npm run build -w @chatai/frontend` passes

  **QA Scenarios**:
  ```
  Scenario: No references to deleted hooks remain
    Tool: Bash (grep)
    Steps: 1. grep -r "useThreadChat\|useMessageStatus" apps/frontend/src/
    Expected Result: No matches
    Evidence: .sisyphus/evidence/task-T7-no-refs.txt
  ```

  **Commit**: NO (grouped with T14)

- [x] T8. Refactor chat.tsx into modular components

  **What to do**:
  - Split `apps/frontend/src/routes/_auth/chat.tsx` (467-line monolith) into modular components:
    - `apps/frontend/src/components/chat/ChatMessage.tsx` — single message bubble (reuse existing orphaned file)
    - `apps/frontend/src/components/chat/ChatInput.tsx` — message input + send button (reuse existing orphaned file)
    - `apps/frontend/src/components/chat/ChatMessageList.tsx` — scrollable message container
    - `apps/frontend/src/components/chat/ChatHeader.tsx` — thread title + actions
  - Extract inline `sendMessage` into `useChatMessages` hook returning `{ messages, sendMessage, isLoading, error }`
  - Keep existing behavior identical — NO functional changes, NO WebSocket yet
  - Write failing tests first (TDD)

  **Must NOT do**: No WebSocket integration (T18), no behavior changes, no UI redesign

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — component extraction + refactoring
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1
  - **Blocks**: T18 (migration uses refactored components)
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/routes/_auth/chat.tsx` — source monolith
  - `apps/frontend/src/components/ChatMessage.tsx` — orphaned component to reuse
  - `apps/frontend/src/components/ChatInput.tsx` — orphaned component to reuse

  **Acceptance Criteria**:
  - [ ] Chat page renders identically to original
  - [ ] All chat features work (send, copy, regenerate, thread switch)
  - [ ] `npm run build -w @chatai/frontend` passes
  - [ ] No inline `fetch`/streaming logic in `chat.tsx` (delegated to hook)

  **QA Scenarios**:
  ```
  Scenario: Chat page renders and sends message after refactor
    Tool: Playwright
    Steps:
      1. Navigate to /chat
      2. Type "Halo, ini pesan tes" and press Enter
      3. Wait for assistant response
    Expected Result: User message appears, assistant response received (same as before refactor)
    Evidence: .sisyphus/evidence/task-T8-chat-works.png
  ```

  **Commit**: YES (separate pre-migration commit)
  - Message: `refactor(frontend): extract chat.tsx into modular components`
  - Pre-commit: `npm run build -w @chatai/frontend`

- [x] T9. Frontend WebSocket client stub + test scaffold

  **What to do**:
  - Create `apps/frontend/src/lib/chat-ws.ts`:
    - `class ChatWebSocket` with stubs: `connect(threadId)`, `send(content)`, `close()`, `onToken(cb)`, `onDone(cb)`, `onError(cb)`
    - All methods throw "not implemented"
  - Create `apps/frontend/src/lib/__tests__/chat-ws.test.ts` with failing tests for connect, send, onToken
  - Write minimal impl to pass tests (TDD)

  **Must NOT do**: No React hook (T14), no chat.tsx integration (T15)

  **Recommended Agent Profile**:
  - **Category**: `quick` — stub class + test scaffold
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Wave 1 (T1-T6)
  - **Blocks**: T13, T19
  - **Blocked By**: T5 (needs message format)

  **References**:
  - `apps/frontend/src/routes/_auth/chat.tsx` — current message sending pattern
  - `apps/backend/src/lib/ws-protocol.ts` (T5) — message format

  **Acceptance Criteria**:
  - [ ] `apps/frontend/src/lib/chat-ws.ts` exists with stub class
  - [ ] `bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: ChatWebSocket stub tests pass
    Tool: Bash (bun test)
    Steps: 1. bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-T6-ws-stub.txt
  ```

  **Commit**: NO (grouped with T11)

- [x] T10. ChatThreadDO — constructor + storage init + WebSocket accept

  **What to do**:
  - Implement `ChatThreadDO` constructor:
    - `blockConcurrencyWhile` for state initialization
    - Load thread state from `this.ctx.storage` (message history, pending status)
    - Initialize WebSocket connections Set
  - Implement `fetch(request)`:
    - Route `/ws` → upgrade to WebSocket via `this.ctx.acceptWebSocket()`
    - Route `/rpc` → handle internal RPC calls (from queue consumer)
    - Default → 404
  - Implement WebSocket lifecycle:
    - `webSocketMessage(ws, message)` — parse via ws-protocol, handle ping/send_message
    - `webSocketClose(ws)` — remove from connections Set
  - Write failing tests first (TDD)

  **Must NOT do**: No AI streaming logic (T8), no broadcast logic (T9)

  **Recommended Agent Profile**:
  - **Category**: `deep` — core DO infrastructure, state management, WebSocket lifecycle
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T3, T4, T5
  - **Parallel Group**: Wave 2
  - **Blocks**: T8, T9
  - **Blocked By**: T3, T4, T5

  **References**:
  - `apps/backend/src/durable-objects/ChatThreadDO.ts` (T4 skeleton)
  - `apps/backend/src/lib/ws-protocol.ts` (T5)
  - `apps/backend/wrangler.toml` (T3) — DO binding
  - CF DO WebSocket: https://developers.cloudflare.com/durable-objects/api/websockets
  - CF DO storage: https://developers.cloudflare.com/durable-objects/api/storage-api
  - `cloudflare/workers-chat-demo` — DO + WebSocket pattern reference

  **Acceptance Criteria**:
  - [ ] DO accepts WebSocket connections on `/ws` route
  - [ ] DO handles ping/pong via WebSocket
  - [ ] DO stores connection state in memory Set
  - [ ] `blockConcurrencyWhile` guards constructor initialization
  - [ ] Tests pass for WebSocket accept + ping/pong

  **QA Scenarios**:
  ```
  Scenario: WebSocket connection accepted by DO
    Tool: Bash (wrangler dev + wscat)
    Steps:
      1. Start wrangler dev: npx wrangler dev -c apps/backend/wrangler.toml
      2. Connect via WebSocket: wscat -c http://localhost:8787/do/chat-thread/<threadId>/ws
    Expected Result: Connection established, no errors
    Evidence: .sisyphus/evidence/task-T7-ws-connect.txt

  Scenario: Ping/pong works over WebSocket
    Tool: Bash (wrangler dev + wscat)
    Steps:
      1. Connect to DO WebSocket
      2. Send: {"type":"ping"}
    Expected Result: Receive: {"type":"pong"}
    Evidence: .sisyphus/evidence/task-T7-ping-pong.txt
  ```

  **Commit**: NO (grouped with T11)

- [x] T11. ChatThreadDO — RPC handler for consumer relay + periodic KV check

  **What to do**:
  - Implement `queue(queueBatch)` method on ChatThreadDO:
    - Receive `ChatQueuePayload` from queue consumer
    - Validate payload via `chatQueuePayloadSchema`
    - Insert/update assistant message in DB (status: 'pending' if retry=0, keep existing if retry>0)
    - Build chat history from completed messages via Drizzle
    - Call OpenAI via Vercel AI SDK `streamText` (reuse pattern from `stream.ts`)
    - On each token: call `broadcastToken(token)` to WebSocket clients (T9)
    - On finish: update DB (content, status='completed', tokenCount), insert tokenUsage, update threads.totalTokens
    - On error: if retry < 3, re-enqueue with retry+1; else mark status='failed'
  - Write failing tests first (TDD) — mock OpenAI, mock DB, mock WebSocket broadcast

  **Must NOT do**: No broadcast implementation details (that's T9 — just call the method)

  **Recommended Agent Profile**:
  - **Category**: `deep` — AI integration, DB writes, error handling, retry logic
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T2, T7
  - **Parallel Group**: Wave 2
  - **Blocks**: T10, T17
  - **Blocked By**: T2, T7

  **References**:
  - `apps/backend/src/lib/stream.ts` — current `streamAIResponse` pattern (onFinish callback, streamText)
  - `apps/backend/src/lib/retry.ts` — current retry logic (to be unified)
  - `apps/backend/src/routes/chat.ts` — current message insertion pattern
  - `packages/db/src/schema.ts` — messages, tokenUsage, threads tables
  - `@chatai/types` — `ChatQueuePayload` (T2)

  **Acceptance Criteria**:
  - [ ] DO `queue()` method processes ChatQueuePayload correctly
  - [ ] AI streaming calls `broadcastToken` for each token
  - [ ] DB updated on finish: messages.content, status, tokenCount; tokenUsage inserted; threads.totalTokens incremented
  - [ ] On error: re-enqueue with retry+1 if < 3, mark failed if >= 3
  - [ ] Tests pass with mocked OpenAI, DB, and broadcast

  **QA Scenarios**:
  ```
  Scenario: Happy path — message processed, DB updated
    Tool: Bash (bun test)
    Steps: 1. bun test apps/backend/src/durable-objects/__tests__/ChatThreadDO.test.ts -t "queue processes message"
    Expected Result: Test passes — DB updated, tokenUsage inserted
    Evidence: .sisyphus/evidence/task-T8-happy-path.txt

  Scenario: Error triggers retry re-enqueue
    Tool: Bash (bun test)
    Steps: 1. bun test apps/backend/src/durable-objects/__tests__/ChatThreadDO.test.ts -t "retry on error"
    Expected Result: Test passes — payload re-enqueued with retry=1
    Evidence: .sisyphus/evidence/task-T8-retry.txt
  ```

  **Commit**: NO (grouped with T11)

- [x] T12. ChatThreadDO — WebSocket broadcast + token streaming
- [x] T13. Fat queue consumer — OpenAI calls + DB writes (replaces retry.ts)
- [x] T14. Worker entry — wire DO + queue + export

  **What to do**:
  - Edit `apps/backend/src/index.ts`:
    - Import `ChatThreadDO` from `./durable-objects`
    - Import `handleChatQueue` from `./lib/chat-queue`
    - Export: `{ fetch: app.fetch, queue: handleChatQueue, ChatThreadDO }`
  - Remove old chat route import (done in T12)
  - Verify TypeScript compiles

  **Must NOT do**: No route deletion (T12), no queue consumer impl (T10)

  **Recommended Agent Profile**:
  - **Category**: `quick` — wiring imports and exports
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T3, T7
  - **Parallel Group**: Wave 2
  - **Blocks**: T12, T20
  - **Blocked By**: T3, T7

  **References**:
  - `apps/backend/src/index.ts` — current exports (`fetch`, `queue: handleRetry`)

  **Acceptance Criteria**:
  - [ ] `apps/backend/src/index.ts` exports `ChatThreadDO` class
  - [ ] `apps/backend/src/index.ts` exports `queue: handleChatQueue`
  - [ ] `npx tsc --noEmit -p apps/backend/tsconfig.json` passes

  **QA Scenarios**:
  ```
  Scenario: Worker entry compiles with DO and queue
    Tool: Bash (tsc)
    Steps: 1. npx tsc --noEmit -p apps/backend/tsconfig.json
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-T11-compile.txt
  ```

  **Commit**: YES
  - Message: `feat(backend): wire Durable Object and unified queue to worker entry`
  - Pre-commit: `npx tsc --noEmit -p apps/backend/tsconfig.json`

- [x] T15. Remove old sync route + retry handler

  **What to do**:
  - Delete `apps/backend/src/routes/chat.ts` (old sync `/api/chat/stream`)
  - Delete `apps/backend/src/lib/retry.ts` (old retry handler)
  - Delete `apps/backend/src/lib/stream.ts` (old streaming helper)
  - Remove imports/references from `apps/backend/src/index.ts`
  - Remove `CHAT_RETRY_QUEUE` from `wrangler.toml`
  - Remove `CHAT_RETRY_QUEUE` type from `env.ts`
  - Verify no remaining references to deleted files

  **Must NOT do**: No changes to other routes (auth, profile, history)

  **Recommended Agent Profile**:
  - **Category**: `quick` — file deletion + import cleanup
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T11
  - **Parallel Group**: Wave 2
  - **Blocks**: T20
  - **Blocked By**: T11

  **References**:
  - `apps/backend/src/routes/chat.ts` — to be deleted
  - `apps/backend/src/lib/retry.ts` — to be deleted
  - `apps/backend/src/lib/stream.ts` — to be deleted
  - `apps/backend/wrangler.toml` — remove CHAT_RETRY_QUEUE

  **Acceptance Criteria**:
  - [ ] `chat.ts`, `retry.ts`, `stream.ts` deleted
  - [ ] No imports of deleted files remain in codebase
  - [ ] `CHAT_RETRY_QUEUE` removed from wrangler.toml and env.ts
  - [ ] `npx tsc --noEmit -p apps/backend/tsconfig.json` passes
  - [ ] `grep -r "streamAIResponse\|handleRetry\|CHAT_RETRY_QUEUE" apps/backend/` returns nothing

  **QA Scenarios**:
  ```
  Scenario: No references to old code remain
    Tool: Bash (grep)
    Steps: 1. grep -r "streamAIResponse\|handleRetry\|CHAT_RETRY_QUEUE" apps/backend/
    Expected Result: No matches found (exit code 1)
    Evidence: .sisyphus/evidence/task-T12-no-refs.txt

  Scenario: Backend compiles after removal
    Tool: Bash (tsc)
    Steps: 1. npx tsc --noEmit -p apps/backend/tsconfig.json
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-T12-compile.txt
  ```

  **Commit**: YES
  - Message: `feat(backend): remove sync chat route and old retry handler`
  - Pre-commit: `npx tsc --noEmit -p apps/backend/tsconfig.json`

- [x] T16. Frontend WebSocket client implementation

  **What to do**:
  - Implement `apps/frontend/src/lib/chat-ws.ts`:
    - `class ChatWebSocket` — manages WebSocket connection to DO
    - `connect(threadId: string)` — opens WS to `/do/chat-thread/${threadId}/ws`
    - `send(content: string)` — sends `{ type: 'send_message', threadId, content }`
    - `close()` — gracefully closes connection
    - `onToken(cb: (token: string) => void)` — register token callback
    - `onDone(cb: (data: { messageId, tokenCount }) => void)` — register done callback
    - `onError(cb: (msg: string) => void)` — register error callback
    - `onStatus(cb: (status: string) => void)` — register status callback
    - Auto-parse incoming messages via ws-protocol, dispatch to callbacks
    - Handle reconnection with exponential backoff (max 5 attempts)
  - Write failing tests first (TDD) — mock WebSocket

  **Must NOT do**: No React hook (T14), no chat.tsx changes (T15)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — WebSocket client with reconnection logic
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T5, T6, T9
  - **Parallel Group**: Wave 3
  - **Blocks**: T14, T19
  - **Blocked By**: T5, T6, T9

  **References**:
  - `apps/frontend/src/lib/chat-ws.ts` (T6 stub)
  - `apps/backend/src/lib/ws-protocol.ts` (T5) — message format
  - `apps/frontend/src/routes/_auth/chat.tsx` — current message flow to replace

  **Acceptance Criteria**:
  - [ ] `ChatWebSocket` connects to DO WebSocket endpoint
  - [ ] `send()` transmits correctly formatted JSON
  - [ ] Token/done/error/status callbacks fire on matching messages
  - [ ] Reconnection works with exponential backoff (tested with mock)
  - [ ] `bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: WebSocket connects and receives token stream
    Tool: Bash (bun test)
    Steps: 1. bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts -t "receives tokens"
    Expected Result: onToken callback fires for each token message
    Evidence: .sisyphus/evidence/task-T13-token-stream.txt

  Scenario: Reconnection after disconnect
    Tool: Bash (bun test)
    Steps: 1. bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts -t "reconnect"
    Expected Result: Connection re-established, callbacks re-registered
    Evidence: .sisyphus/evidence/task-T13-reconnect.txt
  ```

  **Commit**: NO (grouped with T16)

- [x] T17. useChatWebSocket React hook

  **What to do**:
  - Create `apps/frontend/src/hooks/useChatWebSocket.ts`:
    - Hook that wraps `ChatWebSocket` class
    - State: `messages`, `isLoading`, `isThinking`, `error`
    - `sendMessage(content: string)` — sends via WebSocket, adds user message to state
    - Auto-adds assistant message placeholder on send
    - Appends tokens to assistant message content as they arrive
    - Sets `isLoading=false` and `isThinking=false` on done
    - Sets `error` on error message
    - Cleanup on unmount: close WebSocket
  - Write failing tests first (TDD) — mock ChatWebSocket

  **Must NOT do**: No chat.tsx changes (T15), no error UI (T16)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — React hook with state management
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T13
  - **Parallel Group**: Wave 3
  - **Blocks**: T15, T16
  - **Blocked By**: T13

  **References**:
  - `apps/frontend/src/routes/_auth/chat.tsx` — current state management (useState for messages, isLoading)
  - `apps/frontend/src/hooks/useThreadChat.ts` — existing chat hook pattern (for reference, not to modify)
  - `apps/frontend/src/lib/chat-ws.ts` (T13)

  **Acceptance Criteria**:
  - [ ] Hook manages messages state (user + assistant)
  - [ ] Token callbacks append to assistant message content
  - [ ] Done callback sets loading states correctly
  - [ ] Error callback sets error state
  - [ ] Unmount closes WebSocket
  - [ ] Tests pass with mocked ChatWebSocket

  **QA Scenarios**:
  ```
  Scenario: Hook sends message and receives streaming response
    Tool: Bash (bun test)
    Steps: 1. bun test apps/frontend/src/hooks/__tests__/useChatWebSocket.test.ts -t "streaming response"
    Expected Result: User message added, assistant content builds up token by token
    Evidence: .sisyphus/evidence/task-T14-streaming.txt

  Scenario: Hook handles error gracefully
    Tool: Bash (bun test)
    Steps: 1. bun test apps/frontend/src/hooks/__tests__/useChatWebSocket.test.ts -t "error handling"
    Expected Result: Error state set, loading cleared
    Evidence: .sisyphus/evidence/task-T14-error.txt
  ```

  **Commit**: NO (grouped with T16)

- [x] T18. Update chat.tsx — replace ReadableStream with WebSocket

  **What to do**:
  - Edit `apps/frontend/src/routes/_auth/chat.tsx`:
    - Remove `fetch` + `ReadableStream` + `TextDecoder` streaming logic
    - Replace with `useChatWebSocket` hook (T14)
    - Keep existing UI components (message bubbles, input, send button)
    - Keep existing actions (copy, regenerate) — adapt to new hook
    - Remove `isLoading`/`isThinking` state management (now from hook)
    - Keep message list rendering unchanged
  - Write failing tests first (TDD) — mock hook

  **Must NOT do**: No changes to other routes, no UI redesign

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — route component refactor
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T9, T14
  - **Parallel Group**: Wave 3
  - **Blocks**: T16
  - **Blocked By**: T9, T14

  **References**:
  - `apps/frontend/src/routes/_auth/chat.tsx` — current implementation to refactor
  - `apps/frontend/src/hooks/useChatWebSocket.ts` (T14)
  - `apps/backend/src/lib/ws-protocol.ts` (T5) — message format

  **Acceptance Criteria**:
  - [ ] No `fetch`, `ReadableStream`, `getReader`, `TextDecoder` in chat.tsx
  - [ ] `useChatWebSocket` hook used for all chat operations
  - [ ] UI renders messages correctly (user + assistant)
  - [ ] Send button triggers WebSocket send
  - [ ] `npm run build -w @chatai/frontend` passes

  **QA Scenarios**:
  ```
  Scenario: No ReadableStream references remain
    Tool: Bash (grep)
    Steps: 1. grep -c "ReadableStream\|getReader\|TextDecoder" apps/frontend/src/routes/_auth/chat.tsx
    Expected Result: 0 matches
    Evidence: .sisyphus/evidence/task-T15-no-stream.txt

  Scenario: Frontend builds successfully
    Tool: Bash (vite)
    Steps: 1. npm run build -w @chatai/frontend
    Expected Result: Exit code 0, no errors
    Evidence: .sisyphus/evidence/task-T15-build.txt
  ```

  **Commit**: NO (grouped with T16)

- [x] T19. Error handling + reconnect logic + loading states

  **What to do**:
  - Add error UI to chat.tsx:
    - Show error banner when WebSocket error received (Indonesian: "Gagal terhubung, mencoba ulang...")
    - Show retry button on failed assistant messages
    - Show "Sedang mengetik..." loading indicator during streaming
  - Add reconnect logic:
    - Auto-reconnect on WebSocket close (exponential backoff, max 5)
    - Show reconnecting indicator in UI
    - Re-fetch message history after reconnect to sync state
  - Handle edge cases:
    - User sends message while disconnected → queue locally, send on reconnect
    - Multiple tabs open → all receive same updates via DO broadcast
  - Write failing tests first (TDD)

  **Must NOT do**: No changes to auth, profile, history routes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — error UI, loading states, reconnect UX
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T14, T15
  - **Parallel Group**: Wave 3
  - **Blocks**: T20
  - **Blocked By**: T14, T15

  **References**:
  - `apps/frontend/src/routes/_auth/chat.tsx` (T15) — current UI
  - `apps/frontend/src/hooks/useChatWebSocket.ts` (T14) — hook with error state
  - Existing Indonesian error messages in codebase for language consistency

  **Acceptance Criteria**:
  - [ ] Error banner shows on WebSocket error (Indonesian text)
  - [ ] Retry button on failed messages re-sends via WebSocket
  - [ ] Loading indicator shows during streaming
  - [ ] Reconnecting indicator shows during auto-reconnect
  - [ ] Queued messages sent after reconnect
  - [ ] `npm run build -w @chatai/frontend` passes

  **QA Scenarios**:
  ```
  Scenario: Error banner shows on connection failure
    Tool: Playwright
    Steps:
      1. Start backend (wrangler dev) and frontend (vite dev)
      2. Navigate to /chat
      3. Kill backend server
      4. Attempt to send message
    Expected Result: Error banner "Gagal terhubung, mencoba ulang..." appears
    Evidence: .sisyphus/evidence/task-T16-error-banner.png

  Scenario: Auto-reconnect after server restart
    Tool: Playwright
    Steps:
      1. Start backend, navigate to /chat, connect WebSocket
      2. Kill backend, wait 3s
      3. Restart backend
    Expected Result: Reconnecting indicator → connected, messages sync
    Evidence: .sisyphus/evidence/task-T16-reconnect.png
  ```

  **Commit**: YES
  - Message: `feat(frontend): WebSocket chat UI with error handling and reconnect`
  - Pre-commit: `npm run build -w @chatai/frontend`

- [x] T20. TDD — ChatThreadDO unit tests (comprehensive)
- [x] T21. TDD — Queue consumer unit tests
- [x] T22. TDD — WebSocket client integration tests

  **What to do**:
  - Expand `apps/frontend/src/lib/__tests__/chat-ws.test.ts`:
    - Test connect with correct URL
    - Test send message format
    - Test token callback fires correctly
    - Test done callback fires correctly
    - Test error callback fires correctly
    - Test reconnection with exponential backoff
    - Test close cleans up callbacks
  - All tests must pass with mocked WebSocket

  **Must NOT do**: No implementation changes (T13 already done)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — frontend integration test coverage
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T13
  - **Parallel Group**: Wave 4
  - **Blocks**: T20
  - **Blocked By**: T13

  **References**:
  - `apps/frontend/src/lib/chat-ws.ts` (T13)
  - `apps/frontend/src/lib/__tests__/` — existing frontend test patterns

  **Acceptance Criteria**:
  - [ ] All 7+ test cases pass
  - [ ] `bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts` → 0 failures

  **QA Scenarios**:
  ```
  Scenario: All WebSocket client tests pass
    Tool: Bash (bun test)
    Steps: 1. bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts
    Expected Result: All tests pass, 0 failures
    Evidence: .sisyphus/evidence/task-T19-all-tests.txt
  ```

  **Commit**: YES
  - Message: `test(frontend): WebSocket client integration tests`
  - Pre-commit: `bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts`

- [x] T23. Full build + lint + typecheck verification

  **What to do**:
  - Run full monorepo build: `npm run build`
  - Run lint: `npm run lint`
  - Run frontend typecheck: `npm run build -w @chatai/frontend`
  - Run all tests: `bun test` (or `npm test`)
  - Fix any failures
  - Verify no references to old code remain

  **Must NOT do**: No new feature implementation

  **Recommended Agent Profile**:
  - **Category**: `quick` — verification commands
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on T10, T11, T12, T16, T17, T18, T19
  - **Parallel Group**: Wave 4 (final implementation wave)
  - **Blocks**: F1-F4
  - **Blocked By**: T10, T11, T12, T16, T17, T18, T19

  **References**:
  - Root `package.json` — build/lint scripts
  - All changed files from T1-T19

  **Acceptance Criteria**:
  - [ ] `npm run build` → exit 0
  - [ ] `npm run lint` → exit 0
  - [ ] `npm run build -w @chatai/frontend` → exit 0
  - [ ] `bun test` → 0 failures
  - [ ] `grep -r "streamAIResponse\|handleRetry\|CHAT_RETRY_QUEUE\|ReadableStream" apps/backend/src apps/frontend/src/routes/_auth/chat.tsx` → no matches

  **QA Scenarios**:
  ```
  Scenario: Full monorepo build passes
    Tool: Bash (npm)
    Steps: 1. npm run build
    Expected Result: Exit code 0, all packages build in order
    Evidence: .sisyphus/evidence/task-T20-build.txt

  Scenario: All tests pass
    Tool: Bash (bun test)
    Steps: 1. bun test
    Expected Result: 0 failures across all test files
    Evidence: .sisyphus/evidence/task-T20-tests.txt

  Scenario: No old code references remain
    Tool: Bash (grep)
    Steps: 1. grep -r "streamAIResponse\|handleRetry\|CHAT_RETRY_QUEUE" apps/
    Expected Result: No matches
    Evidence: .sisyphus/evidence/task-T20-no-refs.txt
  ```

  **Commit**: YES
  - Message: `chore: full build verification and cleanup`
  - Pre-commit: `npm run build && npm run lint && bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **T11**: `feat(backend): wire Durable Object and unified queue to worker entry`
  - Files: `apps/backend/src/index.ts`, `apps/backend/src/durable-objects/`, `apps/backend/src/lib/chat-queue.ts`
  - Pre-commit: `npx tsc --noEmit -p apps/backend/tsconfig.json`

- **T12**: `feat(backend): remove sync chat route and old retry handler`
  - Files: `apps/backend/src/routes/chat.ts` (deleted), `apps/backend/src/lib/retry.ts` (deleted), `apps/backend/src/lib/stream.ts` (deleted), `apps/backend/wrangler.toml`, `apps/backend/src/env.ts`
  - Pre-commit: `npx tsc --noEmit -p apps/backend/tsconfig.json`

- **T16**: `feat(frontend): WebSocket chat UI with error handling and reconnect`
  - Files: `apps/frontend/src/routes/_auth/chat.tsx`, `apps/frontend/src/hooks/useChatWebSocket.ts`, `apps/frontend/src/lib/chat-ws.ts`
  - Pre-commit: `npm run build -w @chatai/frontend`

- **T17**: `test(backend): comprehensive ChatThreadDO unit tests`
  - Files: `apps/backend/src/durable-objects/__tests__/ChatThreadDO.test.ts`
  - Pre-commit: `bun test apps/backend/src/durable-objects/__tests__/ChatThreadDO.test.ts`

- **T18**: `test(backend): queue consumer unit tests`
  - Files: `apps/backend/src/lib/__tests__/chat-queue.test.ts`
  - Pre-commit: `bun test apps/backend/src/lib/__tests__/chat-queue.test.ts`

- **T19**: `test(frontend): WebSocket client integration tests`
  - Files: `apps/frontend/src/lib/__tests__/chat-ws.test.ts`
  - Pre-commit: `bun test apps/frontend/src/lib/__tests__/chat-ws.test.ts`

- **T20**: `chore: full build verification and cleanup`
  - Files: various (verification only)
  - Pre-commit: `npm run build && npm run lint && bun test`

---

## Success Criteria

### Verification Commands
```bash
npm run build              # Expected: all packages build in order, exit 0
npm run lint               # Expected: no lint errors, exit 0
npm run build -w @chatai/frontend  # Expected: tsc + vite build pass, exit 0
bun test                   # Expected: 0 failures across all test files
```

### Final Checklist
- [ ] All "Must Have" present (DO per thread, WebSocket streaming, unified queue, DB consistency, Indonesian errors, auth preserved)
- [ ] All "Must NOT Have" absent (no DB schema changes, no auth changes, no sync endpoint, no AI slop)
- [ ] All tests pass
- [ ] All evidence files captured in `.sisyphus/evidence/`
- [ ] Old code fully removed (chat.ts, retry.ts, stream.ts, CHAT_RETRY_QUEUE)
