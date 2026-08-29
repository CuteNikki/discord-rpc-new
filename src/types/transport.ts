/**
 * Normalized message shape both transports emit, so Client doesn't
 * need to know about IPC opcodes vs raw WebSocket JSON frames.
 */
export type TransportMessage = { type: 'frame'; data: any } | { type: 'ping'; data: any } | { type: 'close'; data: any };

export interface Transport {
  connect(clientId: string): Promise<void>;
  destroy(): void;
  /** Sends a {cmd, args, evt, nonce} command frame. */
  sendFrame(payload: object): void;
  /** Sends a keepalive ping. No-op for transports where it isn't needed. */
  ping(nonce: string): void;
  onMessage(callback: (message: TransportMessage) => void): void;
  onClose(callback: () => void): void;
}
