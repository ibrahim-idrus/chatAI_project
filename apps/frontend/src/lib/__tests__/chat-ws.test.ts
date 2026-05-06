import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { ChatWebSocket } from '../chat-ws'

// Mock browser globals
const mockSend = mock<(data: string) => void>(() => {})
let _openHandler: (() => void) | null = null

globalThis.WebSocket = mock(() => ({
  readyState: 1, // WebSocket.OPEN
  send: mockSend,
  close: mock(() => {}),
  onopen: null as unknown as (() => void) | null,
  onclose: null as unknown as (() => void) | null,
  onerror: null as unknown as (() => void) | null,
  onmessage: null as unknown as ((e: MessageEvent) => void) | null,
})) as unknown as typeof WebSocket

globalThis.window = {
  location: { protocol: 'http:', host: 'localhost:5173' },
} as unknown as Window & typeof globalThis

beforeEach(() => {
  mockSend.mockClear()
  _openHandler = null
})

describe('ChatWebSocket', () => {
  it('connect creates WebSocket connection', () => {
    const ws = new ChatWebSocket()
    const connectSpy = mock((id: string) => {
      ws.connect(id)
    })
    connectSpy('thread-123')
    expect((ws as any).threadId).toBe('thread-123')
  })

  it('send throws when content is empty', () => {
    const ws = new ChatWebSocket()
    expect(() => ws.send('')).toThrow('Not connected')
  })

  it('send throws when not connected', () => {
    const ws = new ChatWebSocket()
    expect(() => ws.send('hello')).toThrow('Not connected')
  })

  it('close cleans up state', () => {
    const ws = new ChatWebSocket()
    const connectSpy = mock((id: string) => {
      ;(ws as any).threadId = id
    })
    connectSpy('thread-123')
    ws.close()
    expect((ws as any).connected).toBe(false)
  })

  it('onToken, onDone, onError, onOpen, onStatus register callbacks', () => {
    const ws = new ChatWebSocket()

    const tokenCb = (_token: string) => {}
    const doneCb = (_data: { messageId: string; tokenCount: number }) => {}
    const errorCb = (_msg: string) => {}
    const statusCb = (_s: string) => {}
    const openCb = () => {}

    ws.onToken(tokenCb)
    ws.onDone(doneCb)
    ws.onError(errorCb)
    ws.onStatus(statusCb)
    ws.onOpen(openCb)

    expect((ws as any)._onToken).toBe(tokenCb)
    expect((ws as any)._onDone).toBe(doneCb)
    expect((ws as any)._onError).toBe(errorCb)
    expect((ws as any)._onStatus).toBe(statusCb)
    expect((ws as any)._onOpen).toBe(openCb)
  })
})
