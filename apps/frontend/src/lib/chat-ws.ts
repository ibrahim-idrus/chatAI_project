type TokenCallback = (token: string) => void
type DoneCallback = (data: { messageId: string; tokenCount: number }) => void
type ErrorCallback = (msg: string) => void
type StatusCallback = (status: string) => void
type OpenCallback = () => void

type WsServerMessage =
  | { type: 'token'; content: string }
  | { type: 'done'; messageId: string; tokenCount: number }
  | { type: 'error'; message: string }
  | { type: 'pong' }
  | { type: 'status'; status: string }

export class ChatWebSocket {
  private ws: WebSocket | null = null
  private threadId: string | null = null
  private connected = false
  private _reconnectAttempts = 0
  private readonly _maxReconnectAttempts = 5
  private _shouldReconnect = false
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null

  private _onToken: TokenCallback | null = null
  private _onDone: DoneCallback | null = null
  private _onError: ErrorCallback | null = null
  private _onStatus: StatusCallback | null = null
  private _onOpen: OpenCallback | null = null

  get isConnected(): boolean {
    return this.connected
  }

  connect(threadId: string): void {
    this.threadId = threadId
    this._shouldReconnect = true
    this._reconnectAttempts = 0
    this._openConnection()
  }

  send(content: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected')
    }
    if (!content) {
      throw new Error('Content cannot be empty')
    }
    this.ws.send(
      JSON.stringify({ type: 'send_message', threadId: this.threadId, content }),
    )
  }

  close(): void {
    this._shouldReconnect = false
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    this._reconnectAttempts = 0
  }

  onToken(cb: TokenCallback): void {
    this._onToken = cb
  }

  onDone(cb: DoneCallback): void {
    this._onDone = cb
  }

  onError(cb: ErrorCallback): void {
    this._onError = cb
  }

  onStatus(cb: StatusCallback): void {
    this._onStatus = cb
  }

  onOpen(cb: OpenCallback): void {
    this._onOpen = cb
  }

  private _getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/chat/ws/${this.threadId}`
  }

  private _openConnection(): void {
    if (!this.threadId) return

    const url = this._getWebSocketUrl()
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.connected = true
      this._reconnectAttempts = 0
      this._onOpen?.()
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WsServerMessage
        this._dispatchMessage(data)
      } catch {
        /* skip unparseable */
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.ws = null
      if (this._shouldReconnect) {
        this._scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      /* onclose fires after onerror, triggering reconnect */
    }
  }

  private _dispatchMessage(msg: WsServerMessage): void {
    switch (msg.type) {
      case 'token':
        this._onToken?.(msg.content)
        break
      case 'done':
        this._onDone?.({ messageId: msg.messageId, tokenCount: msg.tokenCount })
        break
      case 'error':
        this._onError?.(msg.message)
        break
      case 'status':
        this._onStatus?.(msg.status)
        break
      case 'pong':
        break
    }
  }

  private _scheduleReconnect(): void {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) return
    this._reconnectAttempts++

    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 16000)
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this._openConnection()
    }, delay)
  }
}
