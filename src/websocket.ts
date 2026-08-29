import type { Transport, TransportMessage } from './types';

const WS_PORT_RANGE = { min: 6463, max: 6472 } as const;

export class WebSocketConnection implements Transport {
  private socket?: WebSocket;
  private messageCallback?: (message: TransportMessage) => void;
  private closeCallback?: () => void;

  async connect(clientId: string, portIndex: number = WS_PORT_RANGE.min): Promise<void> {
    if (portIndex > WS_PORT_RANGE.max) {
      throw new Error('Could not find a running Discord instance on any local WebSocket port.');
    }

    try {
      await this.tryConnect(clientId, portIndex);
    } catch {
      // Only a failure to establish the connection advances to the next
      // port. Once connected, errors are handled via 'close' instead —
      // see tryConnect.
      return this.connect(clientId, portIndex + 1);
    }
  }

  private tryConnect(clientId: string, portIndex: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://127.0.0.1:${portIndex}/?v=1&client_id=${clientId}&encoding=json`;
      const socket = new WebSocket(url);

      // Before we're connected, any error means "nothing listening here" —
      // reject so the caller can try the next port.
      socket.onerror = () => {
        socket.close();
        reject(new Error(`No Discord WebSocket server on port ${portIndex}`));
      };

      socket.onopen = () => {
        this.socket = socket;

        // Once connected, an error is a connection problem, not a "wrong
        // port" signal — stop treating it as one. The 'close' event that
        // follows will drive Client's reconnect logic instead.
        socket.onerror = () => {};

        socket.onmessage = (event) => {
          try {
            this.messageCallback?.({ type: 'frame', data: JSON.parse(event.data as string) });
          } catch {
            // ignore malformed frame
          }
        };
        socket.onclose = () => this.closeCallback?.();
        resolve();
      };
    });
  }

  sendFrame(payload: object) {
    this.socket?.send(JSON.stringify(payload));
  }

  ping() {
    // Native WebSocket keepalive is handled at the protocol level;
    // there's no documented app-level ping frame for this transport.
    // Flagging this as unverified rather than guessing at a wire format.
  }

  onMessage(callback: (message: TransportMessage) => void) {
    this.messageCallback = callback;
  }

  onClose(callback: () => void) {
    this.closeCallback = callback;
  }

  destroy() {
    this.socket?.close();
  }
}
