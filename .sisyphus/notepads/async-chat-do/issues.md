# Scope Fidelity Check Findings

## Wave 1 (T1-T9) - SCAFFOLDING
- T1: Branch `feat/async-chat-durable-objects` exists and active
- T2: Queue types in `packages/types/src/queue.ts` with correct Zod schema
- T3: Wrangler.toml has DO binding `CHAT_THREAD_DO` + queue `chat-queue` producer/consumer
- T3: env.ts has `CHAT_THREAD_DO` and `CHAT_QUEUE` typed bindings
- T4: ChatThreadDO.ts + index.ts barrel export exist
- T5: ws-protocol.ts with client/server schemas + parse/serialize helpers
- T6: session.ts with `validateSession` extracted; auth.ts updated to use it
- T7: useThreadChat.ts and useMessageStatus.ts deleted; no references remain
- T8: chat.tsx refactored into components/chat/ (ChatMessage, ChatInput, ChatMessageList, ChatHeader, ChatSidebar, ChatErrorBanner, ChatReconnectIndicator)
- T9: chat-ws.ts ChatWebSocket class with connect/send/close/callbacks + reconnect logic

## Wave 2 (T10-T15) - BACKEND
- T10: DO constructor with blockConcurrencyWhile, storage init, WebSocket accept on /ws, ping/pong handling
- T11: DO `queue()` method processes ChatQueuePayload, calls OpenAI streamText, updates DB
- T12: broadcastToken, broadcastDone, broadcastError, broadcastStatus methods exist
- T13: chat-queue.ts queue consumer forwards to DO via RPC
- T14: index.ts exports ChatThreadDO + handleChatQueue
- T15: chat.ts, retry.ts, stream.ts deleted; no references remain

## Wave 3 (T16-T19) - FRONTEND
- T16: chat-ws.ts fully implemented with reconnect (exponential backoff, max 5)
- T17: useChatWebSocket hook with messages/isLoading/isThinking/error/connected states
- T18: chat.tsx migrated to useChatWebSocket; no ReadableStream/getReader/TextDecoder remaining
- T19: ChatErrorBanner + ChatReconnectIndicator components exist

## Wave 4 (T20-T23) - TESTS
- T20: ChatThreadDO.test.ts comprehensive (683 lines, 18 tests)
- T21: chat-queue.test.ts (6 tests)
- T22: chat-ws.test.ts (6 tests) + useChatWebSocket.test.ts (8 tests)
- T23: Backend compiles. Frontend build FAILS due to pre-existing TS errors (login.tsx, register.tsx, HistoryPage.tsx, useAuth.ts). 8 test failures in session.test.ts.

## GAPS & DEVIATIONS
1. broadcastDone/broadcastError/broadcastStatus defined but NEVER called by DO queue method
2. DO queue uses `msg.attempts` instead of payload `retry` field for retry logic
3. DO queue inserts duplicate assistant message on retry=0 (enqueueMessage already inserted one)
4. chat.tsx line 75 has empty catch block `{}` — violates "Must NOT Have" guardrail
5. useChatMessages.ts still exists with references to deleted `/api/chat/stream` — dead code
6. threads.ts is new but not explicitly in plan (functionally necessary but unaccounted)
7. vitest.config.ts is new and not in plan
8. 8 test failures (session.test.ts mock type issues)
9. Frontend build fails due to pre-existing TS errors (not caused by this plan)

## CONTAMINATION
- useChatMessages.ts: references deleted `/api/chat/stream`, dead code left behind
- Minor: vitest.config.ts not in plan
- Minor: threads.ts not in plan but functionally required
