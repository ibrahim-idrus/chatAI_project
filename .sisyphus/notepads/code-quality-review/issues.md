# Code Quality Review Findings

## Build & Type Errors
- Backend tsc fails on test files (`bun:test` module not found) and mock type incompatibilities in `session.test.ts`
- Frontend build fails on:
  - Test files referencing `bun:test`
  - `happy-dom` type incompatibility with `Window` in `useChatWebSocket.test.ts`
  - TanStack Router navigation type errors in `useAuth.ts`, `HistoryPage.tsx`, `login.tsx`, `register.tsx` caused by adding `validateSearch` to `chat.tsx` route

## Test Failures (8 total)
- `apps/frontend/src/lib/__tests__/chat-ws.test.ts`: 5 fails — tests access private fields via `as any` and mock WebSocket doesn't properly simulate connection state
- `apps/backend/src/lib/__tests__/session.test.ts`: 3 fails — mock setup issues; `validateSession` returns null, `authMiddleware` returns 401

## Code Quality Issues Found
1. `as any` in `chat-ws.test.ts` (7 instances) accessing private class fields
2. Empty catch blocks in frontend production code:
   - `apps/frontend/src/routes/_auth/chat.tsx:75,111`
   - `apps/frontend/src/hooks/useChatMessages.ts:57,125`
3. `broadcastDone` and `broadcastStatus` in `ChatThreadDO.ts` are defined but never called
4. Duplicate assistant message insert in `ChatThreadDO.ts` `queue` method (inserts at retry===0 but `enqueueMessage` already inserted one)
5. React `key` anti-pattern in `ChatMessage.tsx` (key on internal div instead of at map call site)
6. Dead code: `useChatMessages.ts` appears unused (chat.tsx uses `useChatWebSocket`)
7. Route casing: `ChatSidebar.tsx` links to `/HistoryPage` (should likely be `/history`)
8. Unused imports: `beforeEach` in `chat-queue.test.ts`, `openHandler` in `chat-ws.test.ts`

## Pre-existing vs New
- `console.error` in `auth.ts`, `logger.ts`, `error.ts` — pre-existing
- TanStack Router navigation errors in `useAuth.ts`, `login.tsx`, `register.tsx`, `HistoryPage.tsx` — NEW (caused by route definition changes, files themselves unchanged)
