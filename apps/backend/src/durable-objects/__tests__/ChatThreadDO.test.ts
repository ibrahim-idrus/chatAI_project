import { describe, it, expect, mock, beforeAll } from 'bun:test'
import type { Env } from '../../env'

mock.module('cloudflare:workers', () => ({
  DurableObject: class MockDurableObject {
    ctx: unknown
    env: unknown
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx
      this.env = env
    }
  }
}))

const mockValidateSession = mock(
  (_token: string, _env: unknown): Promise<{ userId: string; role: string; sessionId: string } | null> =>
    Promise.resolve(null)
)

const sessionModulePath = new URL('../../lib/session.ts', import.meta.url).pathname
mock.module(sessionModulePath, () => ({
  validateSession: mockValidateSession
}))

let streamTextThrow = false
const mockStreamText = mock(() => {
  if (streamTextThrow) {
    throw new Error('OpenAI stream error')
  }
  return {
    textStream: (async function* () {
      yield 'Hello'
      yield ' '
      yield 'world'
    })(),
    get text() { return Promise.resolve('Hello world') },
    get usage() { return Promise.resolve({ inputTokens: 10, outputTokens: 3, totalTokens: 13 }) },
  }
})

mock.module('ai', () => ({
  streamText: mockStreamText
}))

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: mock(() => (model: string) => ({ model, provider: 'openai' }))
}))

let insertCallCount = 0
const mockDbOps: Array<{ op: string; args?: unknown }> = []
let mockHistoryRows: Array<{ role: string; content: string }> = []

const mockDb = {
  select: () => mockDb,
  from: () => mockDb,
  where: () => mockDb,
  orderBy: () => Promise.resolve(mockHistoryRows),
  insert: () => ({
    values: () => ({
      returning: () => {
        insertCallCount++
        const id = insertCallCount === 1 ? 'user-msg-456' : 'assistant-msg-789'
        mockDbOps.push({ op: 'insert', args: { id } })
        return Promise.resolve([{ id }])
      }
    })
  }),
  update: () => ({
    set: (vals: unknown) => ({
      where: () => {
        mockDbOps.push({ op: 'update', args: vals })
        return Promise.resolve()
      }
    })
  }),
}

const dbModulePath = new URL('../../lib/db.ts', import.meta.url).pathname
mock.module(dbModulePath, () => ({
  getDb: mock(() => mockDb)
}))

const loggerModulePath = new URL('../../lib/logger.ts', import.meta.url).pathname
mock.module(loggerModulePath, () => ({
  logEvent: mock(() => Promise.resolve())
}))

class MockWebSocket {
  readyState = 1
  send = mock((_data: string | ArrayBuffer) => {})
  close = mock(() => {})
}

class MockWebSocketPair {
  [n: number]: WebSocket
  constructor() {
    this[0] = new MockWebSocket() as unknown as WebSocket
    this[1] = new MockWebSocket() as unknown as WebSocket
  }
}

Object.defineProperty(globalThis, 'WebSocketPair', {
  value: MockWebSocketPair,
  writable: true,
  configurable: true
})

let ChatThreadDO: typeof import('../ChatThreadDO').ChatThreadDO

beforeAll(async () => {
  const mod = await import('../ChatThreadDO')
  ChatThreadDO = mod.ChatThreadDO
})

function resetMocks() {
  insertCallCount = 0
  mockDbOps.length = 0
  mockHistoryRows = [
    { role: 'user', content: 'Hello' }
  ]
  streamTextThrow = false
  mockStreamText.mockClear()
}

function createMockState(options: { threadId?: string; userId?: string | null; messageId?: string | null; sessionId?: string | null } = {}) {
  const initPromise = { current: Promise.resolve() }
  const storageMap = new Map<string, unknown>()

  if (options.userId !== undefined) storageMap.set('userId', options.userId)
  if (options.messageId !== undefined) storageMap.set('currentMessageId', options.messageId)
  if (options.threadId) storageMap.set('threadId', options.threadId)
  if (options.sessionId !== undefined) storageMap.set('sessionId', options.sessionId)

  const mockStorage = {
    get: mock(<T>(key: string) => Promise.resolve(storageMap.get(key) as T | undefined)),
    put: mock((key: string, value: unknown) => {
      storageMap.set(key, value)
      return Promise.resolve()
    }),
    delete: mock((key: string) => {
      storageMap.delete(key)
      return Promise.resolve()
    }),
    deleteAlarm: mock(() => Promise.resolve()),
    setAlarm: mock(() => Promise.resolve()),
    getAlarm: mock(() => Promise.resolve(null)),
    list: mock(() => Promise.resolve(new Map())),
  }

  const mockAcceptWebSocket = mock((_ws: WebSocket) => {})

  const state = {
    id: {
      toString: () => options.threadId ?? 'test-thread-id',
      equals: () => false,
      name: undefined,
    } as DurableObjectId,
    storage: mockStorage as unknown as DurableObjectStorage,
    acceptWebSocket: mockAcceptWebSocket,
    blockConcurrencyWhile: (cb: () => Promise<void>) => {
      initPromise.current = cb()
      return initPromise.current
    },
  } as unknown as DurableObjectState

  return { state, initPromise, storageMap, acceptWebSocket: mockAcceptWebSocket }
}

let queueSendMock = mock(() => Promise.resolve())

function createMockEnv(): Env {
  return {
    DATABASE_URL: 'postgres://test',
    JWT_SECRET: 'test-secret',
    OPENAI_API_KEY: 'test-key',
    AI_MODEL: 'gpt-4',
    AI_PROVIDER: 'openai',
    SYSTEM_PROMPT: 'You are a test assistant.',
    AI: {} as Ai,
    SESSION_KV: { get: mock(() => Promise.resolve(null)) } as unknown as KVNamespace,
    CHAT_THREAD_DO: {} as unknown as DurableObjectNamespace,
    AI_PROCESSING_QUEUE: { send: queueSendMock } as unknown as Queue,
  } as Env
}

describe('ChatThreadDO', () => {
  it('accepts WebSocket connection on /ws route', async () => {
    mockValidateSession.mockImplementation(() =>
      Promise.resolve({ userId: 'user-123', role: 'user', sessionId: 'sess-456' })
    )

    const { state, initPromise } = createMockState()
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const request = new Request('http://localhost/do/test-thread-id/ws?token=valid-token')
    const response = await do_.fetch(request)

    expect(response.status).toBe(101)
    expect(state.acceptWebSocket).toHaveBeenCalled()

    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    expect(connections.size).toBe(1)
  })

  it('responds to ping with pong', async () => {
    const { state, initPromise } = createMockState()
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    await do_.webSocketMessage(ws, '{"type":"ping"}')

    expect(ws.send).toHaveBeenCalledWith('{"type":"pong"}')
  })

  it('calls processMessage on send_message', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const processSpy = mock(() => Promise.resolve())
    Object.defineProperty(do_, 'processMessage', { value: processSpy, writable: true })

    const ws = new MockWebSocket() as unknown as WebSocket
    await do_.webSocketMessage(
      ws,
      '{"type":"send_message","threadId":"test-thread-id","content":"hello"}'
    )

    expect(processSpy).toHaveBeenCalledTimes(1)
    const arg = processSpy.mock.calls[0][0] as { threadId: string; content: string }
    expect(arg.threadId).toBe('test-thread-id')
    expect(arg.content).toBe('hello')
  })

  it('returns 401 for invalid token', async () => {
    mockValidateSession.mockImplementation(() => Promise.resolve(null))

    const { state, initPromise } = createMockState()
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const request = new Request('http://localhost/do/test-thread-id/ws?token=invalid-token')
    const response = await do_.fetch(request)

    expect(response.status).toBe(401)
  })

  it('removes connection from Set on webSocketClose', async () => {
    const { state, initPromise } = createMockState()
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    await do_.webSocketClose(ws, 1000, 'normal')

    expect(connections.has(ws)).toBe(false)
  })

  it('removes connection from Set on webSocketError', async () => {
    const { state, initPromise } = createMockState()
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    await do_.webSocketError(ws, new Error('test error'))

    expect(connections.has(ws)).toBe(false)
  })

  it('processMessage inserts user + assistant messages and sends to queue', async () => {
    resetMocks()
    queueSendMock.mockClear()
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id', userId: 'user-123' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const statusSpy = mock(() => {})
    Object.defineProperty(do_, 'broadcastStatus', { value: statusSpy, writable: true })

    await (do_ as unknown as { processMessage: (msg: { threadId: string; content: string }) => Promise<void> }).processMessage({ threadId: 'test-thread-id', content: 'hello' })

    expect(mockDbOps.filter(op => op.op === 'insert').length).toBe(2)
    expect(statusSpy).toHaveBeenCalledTimes(1)
    expect(statusSpy).toHaveBeenCalledWith('processing')
    expect(queueSendMock).toHaveBeenCalledTimes(1)
    const queuePayload = queueSendMock.mock.calls[0][0] as Record<string, unknown>
    expect(queuePayload.threadId).toBe('test-thread-id')
    expect(queuePayload.userId).toBe('user-123')
    expect(queuePayload.content).toBe('hello')
    expect(queuePayload.messageId).toBe('assistant-msg-789')
  })

  it('handleRpc get_status returns thread info', async () => {
    const { state, initPromise } = createMockState({
      threadId: 'test-thread-id',
      userId: 'user-123',
      messageId: 'msg-456'
    })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const request = new Request('http://localhost/do/test-thread-id/rpc', {
      method: 'POST',
      body: JSON.stringify({ type: 'get_status' }),
    })
    const response = await do_.fetch(request)
    const body = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.threadId).toBe('test-thread-id')
    expect(body.userId).toBe('user-123')
    expect(body.connections).toBe(0)
    expect(body.currentMessageId).toBe('msg-456')
  })

  it('handleRpc validate_session closes WS when session expired', async () => {
    const { state, initPromise } = createMockState({
      threadId: 'test-thread-id',
      userId: 'user-123',
      sessionId: 'sess-456'
    })
    const env = createMockEnv()
    env.SESSION_KV = { get: mock(() => Promise.resolve(null)) } as unknown as KVNamespace
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    const request = new Request('http://localhost/do/test-thread-id/rpc', {
      method: 'POST',
      body: JSON.stringify({ type: 'validate_session' }),
    })
    const response = await do_.fetch(request)
    const body = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(ws.close).toHaveBeenCalledWith(4001, 'Session expired')
    expect(connections.has(ws)).toBe(false)
  })

  it('handleRpc validate_session keeps WS when session valid', async () => {
    const { state, initPromise } = createMockState({
      threadId: 'test-thread-id',
      userId: 'user-123',
      sessionId: 'sess-456'
    })
    const env = createMockEnv()
    env.SESSION_KV = { get: mock(() => Promise.resolve('valid')) } as unknown as KVNamespace
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    const request = new Request('http://localhost/do/test-thread-id/rpc', {
      method: 'POST',
      body: JSON.stringify({ type: 'validate_session' }),
    })
    const response = await do_.fetch(request)
    const body = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(ws.close).not.toHaveBeenCalled()
    expect(connections.has(ws)).toBe(true)
  })

  it('handleRpc returns error for unknown type', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const request = new Request('http://localhost/do/test-thread-id/rpc', {
      method: 'POST',
      body: JSON.stringify({ type: 'unknown_type' }),
    })
    const response = await do_.fetch(request)

    expect(response.status).toBe(400)
  })

  it('broadcastToken sends to all connected clients', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws1 = new MockWebSocket() as unknown as WebSocket
    const ws2 = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws1)
    connections.add(ws2)

    await (do_ as unknown as { broadcastToken: (token: string) => void }).broadcastToken('hello')

    expect(ws1.send).toHaveBeenCalledWith('{"type":"token","content":"hello"}')
    expect(ws2.send).toHaveBeenCalledWith('{"type":"token","content":"hello"}')
  })

  it('broadcastDone sends done message with messageId and tokenCount', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    await (do_ as unknown as { broadcastDone: (messageId: string, tokenCount: number) => void }).broadcastDone('msg-123', 42)

    expect(ws.send).toHaveBeenCalledWith('{"type":"done","messageId":"msg-123","tokenCount":42}')
  })

  it('broadcastError sends error message', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    await (do_ as unknown as { broadcastError: (message: string) => void }).broadcastError('something went wrong')

    expect(ws.send).toHaveBeenCalledWith('{"type":"error","message":"something went wrong"}')
  })

  it('broadcastStatus sends status message', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    await (do_ as unknown as { broadcastStatus: (status: string) => void }).broadcastStatus('processing')

    expect(ws.send).toHaveBeenCalledWith('{"type":"status","status":"processing"}')
  })

  it('removes dead connection from Set after send failure', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const healthyWs = new MockWebSocket() as unknown as WebSocket
    const deadWs = new MockWebSocket() as unknown as WebSocket
    deadWs.send = mock(() => { throw new Error('send failed') })

    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(healthyWs)
    connections.add(deadWs)

    await (do_ as unknown as { broadcastToken: (token: string) => void }).broadcastToken('hello')

    expect(healthyWs.send).toHaveBeenCalledWith('{"type":"token","content":"hello"}')
    expect(connections.has(deadWs)).toBe(false)
    expect(connections.has(healthyWs)).toBe(true)
  })

  it('skips connections that are not OPEN', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const openWs = new MockWebSocket() as unknown as WebSocket
    const closingWs = new MockWebSocket() as unknown as WebSocket & { readyState: number }
    closingWs.readyState = 2
    const closedWs = new MockWebSocket() as unknown as WebSocket & { readyState: number }
    closedWs.readyState = 3

    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(openWs)
    connections.add(closingWs)
    connections.add(closedWs)

    await (do_ as unknown as { broadcastToken: (token: string) => void }).broadcastToken('hello')

    expect(openWs.send).toHaveBeenCalledWith('{"type":"token","content":"hello"}')
    expect(closingWs.send).not.toHaveBeenCalled()
    expect(closedWs.send).not.toHaveBeenCalled()
  })

  it('multiple broadcasts work sequentially', async () => {
    const { state, initPromise } = createMockState({ threadId: 'test-thread-id' })
    const env = createMockEnv()
    const do_ = new ChatThreadDO(state, env)
    await initPromise.current

    const ws = new MockWebSocket() as unknown as WebSocket
    const connections = (do_ as unknown as { connections: Set<WebSocket> }).connections
    connections.add(ws)

    const doCast = do_ as unknown as { broadcastToken: (token: string) => void; broadcastDone: (messageId: string, tokenCount: number) => void; broadcastStatus: (status: string) => void }
    doCast.broadcastToken('first')
    doCast.broadcastToken('second')
    doCast.broadcastStatus('processing')
    doCast.broadcastDone('msg-456', 10)

    expect(ws.send).toHaveBeenCalledTimes(4)
    expect(ws.send).toHaveBeenCalledWith('{"type":"token","content":"first"}')
    expect(ws.send).toHaveBeenCalledWith('{"type":"token","content":"second"}')
    expect(ws.send).toHaveBeenCalledWith('{"type":"status","status":"processing"}')
    expect(ws.send).toHaveBeenCalledWith('{"type":"done","messageId":"msg-456","tokenCount":10}')
  })
})
