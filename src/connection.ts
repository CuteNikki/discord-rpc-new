import { connect, type Socket } from 'node:net';
import { join } from 'node:path';
import type { OpCode } from './types/opcodes';

/**
 * Manages the IPC connection to Discord for Rich Presence.
 */
export class SocketConnection {
  /**
   * Underlying IPC socket connection
   */
  private socket?: Socket;

  /**
   * Buffer to accumulate incoming data chunks
   */
  private buffer = Buffer.alloc(0);

  /**
   * Generates the IPC pipe path based on the OS and index.
   * @param index Pipe index (0-9)
   * @returns The full pipe path as a string
   */
  private getPipePath(index: number): string {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${index}`;
    }
    // Linux logic
    const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env;
    const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
    return join(prefix, `discord-ipc-${index}`);
  }

  /**
   * Establishes the IPC connection to Discord.
   * @param index Current pipe index to try
   * @returns Promise that resolves when connected
   */
  async connect(index = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      const path = this.getPipePath(index);

      this.socket = connect(path);
      this.socket.on('connect', () => resolve());
      this.socket.on('error', (err) => {
        if (index < 9)
          resolve(this.connect(index + 1)); // Try next pipe
        else reject(err);
      });
    });
  }

  /**
   * Closes the IPC connection.
   */
  destroy() {
    this.socket?.destroy();
  }

  /**
   * Sends a data packet to Discord over IPC.
   * @param op Opcode of the packet
   * @param payload Data payload to send
   */
  send(op: OpCode, payload: object) {
    const encoded = Buffer.from(JSON.stringify(payload));
    const header = Buffer.alloc(8);

    header.writeUInt32LE(op, 0);
    header.writeUInt32LE(encoded.length, 4);

    this.socket?.write(Buffer.concat([header, encoded]));
  }

  /**
   * Registers a callback to handle incoming data packets.
   * @param callback Function to call with opcode and parsed payload
   */
  onData(callback: (op: OpCode, data: any) => void) {
    this.socket?.on('data', (chunk: Buffer) => {
      // Append new data to our existing buffer
      this.buffer = Buffer.concat([this.buffer, chunk]);

      // Process all full packets in the buffer
      while (this.buffer.length >= 8) {
        const op = this.buffer.readUInt32LE(0);
        const len = this.buffer.readUInt32LE(4);

        // Safety check for partial packets
        if (this.buffer.length >= 8 + len) {
          const packetData = this.buffer.subarray(8, 8 + len);
          const payload = JSON.parse(packetData.toString());

          callback(op, payload);

          // Remove processed packet from buffer
          this.buffer = this.buffer.subarray(8 + len);
        } else {
          // Not enough data for a full packet yet, wait for next 'data' event
          break;
        }
      }
    });
  }
}
