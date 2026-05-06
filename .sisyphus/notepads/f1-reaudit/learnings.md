# F1 Re-Audit Learnings

## Test Runner
- Tests use `bun:test`, **not** vitest. Must run with `bun test` from the respective app directory.
- Vitest config exists but is unusable due to `bun:test` imports.

## Verified Fixes
All 6 fixes from prior audit are confirmed:
1. `handleRpc` → `processQueuePayload()` at line 342-351 ✅
2. `broadcastDone()` at line 234 ✅
3. `broadcastError()` at line 236 ✅
4. No duplicate assistant message insertion — `processQueuePayload` only updates existing msg via `messageId` ✅
5. No empty catch blocks in `chat.tsx` — both catches have `console.error` ✅
6. `useChatMessages.ts` deleted (glob returns no files) ✅
