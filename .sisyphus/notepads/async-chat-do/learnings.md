

## T19 — Error handling + reconnect logic + loading states

### Changes made
1. **`apps/frontend/src/components/chat/ChatErrorBanner.tsx`** (new):
   - Props: `message: string | null`, `onDismiss?: () => void`
   - Renders a red/orange banner using shadcn semantic tokens (`bg-destructive/10`, `text-destructive`, `border-destructive/20`)
   - Dismiss button with `X` lucide icon
   - Returns `null` when message is null

2. **`apps/frontend/src/components/chat/ChatReconnectIndicator.tsx`** (new):
   - Props: `isReconnecting: boolean`
   - Pulsing yellow dot (`animate-ping`) + `Menyambung kembali...` text
   - Returns `null` when not reconnecting

3. **`apps/frontend/src/components/chat/index.ts`** updated:
   - Added barrel exports for `ChatErrorBanner` and `ChatReconnectIndicator`

4. **`apps/frontend/src/routes/_auth/chat.tsx`** updated:
   - Destructured `error` and `connected` from `useChatWebSocket`
   - Added `<ChatReconnectIndicator isReconnecting={!connected && !isFetchingThread} />` below `<ChatHeader>`
   - Added `<ChatErrorBanner message={error ?? null} />` above `<ChatInput>`
   - Error is already cleared on new message send by `useChatWebSocket.sendMessage`

### Key learnings
- The `useChatWebSocket` hook already clears `error` state inside `sendMessage()` (line 113), so no additional clear logic is needed in the page component.
- Reconnect indicator should not show during initial thread fetch (`!connected && !isFetchingThread`) to avoid flicker on page load.
- shadcn semantic color tokens (`bg-destructive/10`, `text-destructive`, etc.) provide consistent theming without hardcoding colors.

### Verification
- `lsp_diagnostics` on all modified files: zero errors
- `npm run build -w @chatai/frontend`: fails only with pre-existing errors in unrelated files (useAuth.ts, HistoryPage.tsx, login.tsx, register.tsx, test files with bun:test module). No new errors introduced.
