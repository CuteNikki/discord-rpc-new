// Libraries
import { connect, type Socket } from 'node:net';
import { join } from 'node:path';
// Types
import type { OpCode } from './types';

export class SocketConnection {
  /**
   * Socket connection to Discord IPC
   */
  private socket?: Socket;
  /**
   * Buffer for incoming data
   */
  private buffer = Buffer.alloc(0);

  /**
   * Callback for incoming data
   */
  private dataCallback?: (op: OpCode, data: any) => void;

  /**
   * Constructs the pipe path based on the OS and index.
   * @param index Pipe index (0-9)
   * @returns Pipe path string
   */
  private getPipePath(index: number): string {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${index}`;
    }
    const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env;
    const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
    return join(prefix, `discord-ipc-${index}`);
  }

  /**
   * Connects to the Discord IPC socket.
   * @param index Pipe index (0-9)
   * @returns Promise that resolves when connected
   */
  async connect(index = 0): Promise<void> {
    if (index > 9) {
      throw new Error('Could not find a running Discord instance after searching 10 pipes.');
    }

    return new Promise((resolve, reject) => {
      const path = this.getPipePath(index);

      // Clean up old socket if it exists from a previous failed attempt
      if (this.socket) {
        this.socket.destroy();
        this.socket.removeAllListeners();
      }

      this.socket = connect(path);

      this.socket.once('connect', () => {
        this.socket?.removeAllListeners('error'); // Stop the retry logic once connected
        this.setupBufferHandler();
        resolve();
      });

      this.socket.once('error', (err: any) => {
        this.socket?.destroy();

        // Only retry if the pipe doesn't exist
        if (err.code === 'ENOENT') {
          resolve(this.connect(index + 1));
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Preserves your original buffering logic while linking it
   * to the Client's centralized handler.
   */
  private setupBufferHandler() {
    this.socket?.on('data', (chunk: Buffer) => {
      // Your original logic: Append new data to our existing buffer
      this.buffer = Buffer.concat([this.buffer, chunk]);

      // Process all full packets in the buffer
      while (this.buffer.length >= 8) {
        const op = this.buffer.readUInt32LE(0);
        const len = this.buffer.readUInt32LE(4);

        if (this.buffer.length >= 8 + len) {
          const packetData = this.buffer.subarray(8, 8 + len);
          const payload = JSON.parse(packetData.toString());

          // Trigger the callback registered by the Client
          this.dataCallback?.(op, payload);

          this.buffer = this.buffer.subarray(8 + len);
        } else {
          break;
        }
      }
    });
  }

  /**
   * Closes the socket connection to Discord.
   */
  destroy() {
    this.socket?.destroy();
  }

  /**
   * Sends a payload to Discord over the socket connection.
   * @param op OpCode of the payload
   * @param payload Payload object to send
   */
  send(op: OpCode, payload: object) {
    const encoded = Buffer.from(JSON.stringify(payload));
    const header = Buffer.alloc(8);
    header.writeUInt32LE(op, 0);
    header.writeUInt32LE(encoded.length, 4);
    this.socket?.write(Buffer.concat([header, encoded]));
  }

  /**
   * This is now called exactly once by the Client constructor.
   */
  onData(callback: (op: OpCode, data: any) => void) {
    this.dataCallback = callback;
  }
}
