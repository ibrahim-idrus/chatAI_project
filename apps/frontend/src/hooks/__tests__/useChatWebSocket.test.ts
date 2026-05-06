import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { Window } from 'happy-dom'
import { renderHook, act } from '@testing-library/react'
import { useChatWebSocket } from '../useChatWebSocket'

const window = new Window()
globalThis.document = window.document as unknown as Document
globalThis.window = window as unknown as Window & typeof globalThis

const mockConnect = mock(() => {})
const mockSend = mock(() => {})
const mockClose = mock(() => {})
let openCallback: (() => void) | null = null
const mockOnToken = mock(() => {})
const mockOnDone = mock(() => {})
const mockOnError = mock(() => {})
const mockOnStatus = mock(() => {})
const mockOnOpen = mock((cb: () => void) => { openCallback = cb })

class MockChatWebSocket {
  connect = mock((threadId: string) => {
    mockConnect(threadId)
    openCallback?.()
  })
  send = mockSend
  close = mockClose
  onToken = mockOnToken
  onDone = mockOnDone
  onError = mockOnError
  onStatus = mockOnStatus
  onOpen = mockOnOpen
  get isConnected() { return true }
}

mock.module('../../lib/chat-ws', () => ({
  ChatWebSocket: MockChatWebSocket,
}))

describe('useChatWebSocket', () => {
  beforeEach(() => {
    openCallback = null
    mockConnect.mockClear()
    mockSend.mockClear()
    mockClose.mockClear()
    mockOnToken.mockClear()
    mockOnDone.mockClear()
    mockOnError.mockClear()
    mockOnStatus.mockClear()
    mockOnOpen.mockClear()
  })

  it('initializes with empty messages and not loading', () => {
    const { result } = renderHook(() => useChatWebSocket())

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isThinking).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.connected).toBe(false)
  })

  it('connect calls ChatWebSocket.connect and sets connected', () => {
    const { result } = renderHook(() => useChatWebSocket())

    act(() => {
      result.current.connect('thread-123')
    })

    expect(mockConnect).toHaveBeenCalledWith('thread-123')
    expect(result.current.connected).toBe(true)
  })

  it('sendMessage adds user message and assistant placeholder', () => {
    const { result } = renderHook(() => useChatWebSocket())

    act(() => {
      result.current.connect('thread-123')
    })

    act(() => {
      result.current.sendMessage('hello')
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].role).toBe('user')
    expect(result.current.messages[0].content).toBe('hello')
    expect(result.current.messages[1].role).toBe('assistant')
    expect(result.current.messages[1].content).toBe('')
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isThinking).toBe(true)
    expect(mockSend).toHaveBeenCalledWith('hello')
  })

  it('token callback appends to assistant message', () => {
    const { result } = renderHook(() => useChatWebSocket())

    act(() => {
      result.current.connect('thread-123')
    })

    act(() => {
      result.current.sendMessage('hello')
    })

    // Simulate token callbacks
    const tokenCallbacks = mockOnToken.mock.calls
    expect(tokenCallbacks.length).toBeGreaterThan(0)

    const onToken = tokenCallbacks[0][0] as (token: string) => void

    act(() => {
      onToken('Hello')
    })

    act(() => {
      onToken(' world')
    })

    expect(result.current.messages[1].content).toBe('Hello world')
  })

  it('done callback sets loading=false and isThinking=false', () => {
    const { result } = renderHook(() => useChatWebSocket())

    act(() => {
      result.current.connect('thread-123')
    })

    act(() => {
      result.current.sendMessage('hello')
    })

    const doneCallbacks = mockOnDone.mock.calls
    expect(doneCallbacks.length).toBeGreaterThan(0)
    const onDone = doneCallbacks[0][0] as (data: { messageId: string; tokenCount: number }) => void

    act(() => {
      onDone({ messageId: 'msg-456', tokenCount: 10 })
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isThinking).toBe(false)
    expect(result.current.messages[1].id).toBe('msg-456')
  })

  it('error callback sets error state', () => {
    const { result } = renderHook(() => useChatWebSocket())

    act(() => {
      result.current.connect('thread-123')
    })

    act(() => {
      result.current.sendMessage('hello')
    })

    const errorCallbacks = mockOnError.mock.calls
    expect(errorCallbacks.length).toBeGreaterThan(0)
    const onError = errorCallbacks[0][0] as (msg: string) => void

    act(() => {
      onError('Something went wrong')
    })

    expect(result.current.error).toBe('Something went wrong')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isThinking).toBe(false)
    expect(result.current.messages[1].content).toBe('Maaf, terjadi kesalahan. Coba lagi.')
  })

  it('disconnect calls close and resets state', () => {
    const { result } = renderHook(() => useChatWebSocket())

    act(() => {
      result.current.connect('thread-123')
      result.current.sendMessage('hello')
    })

    act(() => {
      result.current.disconnect()
    })

    expect(mockClose).toHaveBeenCalled()
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.connected).toBe(false)
  })

  it('unmount closes WebSocket', () => {
    const { unmount } = renderHook(() => useChatWebSocket())

    unmount()

    expect(mockClose).toHaveBeenCalled()
  })
})
