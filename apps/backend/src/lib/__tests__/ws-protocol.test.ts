import { describe, it, expect } from 'bun:test'
import {
  parseWsClientMessage,
  serializeWsServerMessage,
  wsClientMessageSchema,
  wsServerMessageSchema,
  type WsClientMessage,
} from '../ws-protocol'

describe('wsClientMessageSchema', () => {
  it('accepts ping message', () => {
    const result = wsClientMessageSchema.parse({ type: 'ping' })
    expect(result).toEqual({ type: 'ping' })
  })

  it('accepts send_message message', () => {
    const result = wsClientMessageSchema.parse({
      type: 'send_message',
      threadId: 'abc',
      content: 'hello',
    })
    expect(result).toEqual({ type: 'send_message', threadId: 'abc', content: 'hello' })
  })

  it('rejects unknown type', () => {
    expect(() => wsClientMessageSchema.parse({ type: 'unknown' })).toThrow()
  })
})

describe('wsServerMessageSchema', () => {
  it('accepts token message', () => {
    const result = wsServerMessageSchema.parse({ type: 'token', content: 'Hel' })
    expect(result).toEqual({ type: 'token', content: 'Hel' })
  })

  it('accepts done message', () => {
    const result = wsServerMessageSchema.parse({
      type: 'done',
      messageId: 'm1',
      tokenCount: 10,
    })
    expect(result).toEqual({ type: 'done', messageId: 'm1', tokenCount: 10 })
  })

  it('accepts error message', () => {
    const result = wsServerMessageSchema.parse({ type: 'error', message: 'something went wrong' })
    expect(result).toEqual({ type: 'error', message: 'something went wrong' })
  })

  it('accepts pong message', () => {
    const result = wsServerMessageSchema.parse({ type: 'pong' })
    expect(result).toEqual({ type: 'pong' })
  })

  it('accepts status message', () => {
    const result = wsServerMessageSchema.parse({ type: 'status', status: 'connected' })
    expect(result).toEqual({ type: 'status', status: 'connected' })
  })
})

describe('parseWsClientMessage', () => {
  it('parses valid ping JSON', () => {
    const msg = parseWsClientMessage('{"type":"ping"}')
    expect(msg).toEqual({ type: 'ping' } satisfies WsClientMessage)
  })

  it('parses valid send_message JSON', () => {
    const msg = parseWsClientMessage(
      '{"type":"send_message","threadId":"abc","content":"hello"}',
    )
    expect(msg).toEqual({
      type: 'send_message',
      threadId: 'abc',
      content: 'hello',
    } satisfies WsClientMessage)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseWsClientMessage('invalid')).toThrow('Invalid JSON')
  })

  it('throws on unknown type (discriminated union rejects)', () => {
    expect(() => parseWsClientMessage('{"type":"unknown"}')).toThrow()
  })
})

describe('serializeWsServerMessage', () => {
  it('serializes token message', () => {
    const json = serializeWsServerMessage({ type: 'token', content: 'hello' })
    expect(json).toBe('{"type":"token","content":"hello"}')
  })

  it('serializes done message', () => {
    const json = serializeWsServerMessage({ type: 'done', messageId: 'm1', tokenCount: 10 })
    expect(json).toBe('{"type":"done","messageId":"m1","tokenCount":10}')
  })

  it('serializes error message', () => {
    const json = serializeWsServerMessage({ type: 'error', message: 'err' })
    expect(json).toBe('{"type":"error","message":"err"}')
  })

  it('serializes pong message', () => {
    const json = serializeWsServerMessage({ type: 'pong' })
    expect(json).toBe('{"type":"pong"}')
  })

  it('serializes status message', () => {
    const json = serializeWsServerMessage({ type: 'status', status: 'ok' })
    expect(json).toBe('{"type":"status","status":"ok"}')
  })
})
