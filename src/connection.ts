// Libraries
import { connect, type Socket } from 'node:net';
import { join } from 'node:path';
// Types
import { existsSync, realpathSync } from 'node:fs';
import type { OpCode, PathData } from './types';

const IPC_SOCKET_NAME = 'discord-ipc';
const WINDOWS_IPC_PIPE_PATH = `\\\\?\\pipe\\${IPC_SOCKET_NAME}`;

const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env;
const UNIX_TEMP_DIR_FALLBACK = '/tmp';

const defaultPathList: PathData[] = [
  {
    platform: ['win32'],
    format: (id) => `${WINDOWS_IPC_PIPE_PATH}-${id}`,
  },
  // MacOS and Linux
  {
    platform: ['darwin', 'linux'],
    format: (id) => {
      const prefix = realpathSync(XDG_RUNTIME_DIR ?? TMPDIR ?? TMP ?? TEMP ?? UNIX_TEMP_DIR_FALLBACK);
      return join(prefix, `${IPC_SOCKET_NAME}-${id}`);
    },
  },
  // Linux (Snap)
  {
    platform: ['linux'],
    format: (id) => {
      const prefix = realpathSync(XDG_RUNTIME_DIR ?? TMPDIR ?? TMP ?? TEMP ?? UNIX_TEMP_DIR_FALLBACK);
      return join(prefix, 'snap.discord', `${IPC_SOCKET_NAME}-${id}`);
    },
  },
  // Linux (Flatpak)
  {
    platform: ['linux'],
    format: (id) => {
      const prefix = realpathSync(XDG_RUNTIME_DIR ?? TMPDIR ?? TMP ?? TEMP ?? UNIX_TEMP_DIR_FALLBACK);

      return join(prefix, 'app', 'com.discordapp.Discord', `${IPC_SOCKET_NAME}-${id}`);
    },
  },
];

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
   * Callback for socket close event
   */
  private closeCallback?: () => void;

  /**
   * Connects to the Discord IPC socket.
   * @param index Pipe index (0-9)
   * @returns Promise that resolves when connected
   */
  async connect(index = 0): Promise<void> {
    if (index > 9) {
      throw new Error('Could not find a running Discord instance after searching 10 pipes.');
    }

    const useablePath: string[] = [];
    for (const path of defaultPathList) {
      if (!path.platform.includes(process.platform)) continue;
      const socketPath = path.format(index);

      // Skip if the socket path doesn't exist (only for non-Windows platforms)
      if (process.platform !== 'win32' && !existsSync(socketPath)) continue;
      useablePath.push(socketPath);
    }

    if (useablePath.length === 0) {
      // Skip to the next pipe ID if no useable path is found
      return this.connect(index + 1);
    }

    return new Promise((resolve, reject) => {
      for (const path of useablePath) {
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
      }
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

    this.socket?.on('close', () => {
      this.closeCallback?.();
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

  /**
   * Sets a custom path list for the socket connection.
   * @param pathList Array of PathData objects
   */
  setPathList(pathList: PathData[]) {
    for (const path of pathList) {
      // Add the path to the beginning of the list
      defaultPathList.unshift(path);
    }
  }

  /**
   * Registers a callback for when the socket connection is closed.
   * @param callback Function to call when the socket is closed
   */
  onClose(callback: () => void) {
    this.closeCallback = callback;
  }
}
