// Libraries
import { existsSync } from 'node:fs';
import { connect, type Socket } from 'node:net';
import { join } from 'node:path';
// Types
import { OpCode, type PathData, type Transport, type TransportMessage } from './types';

const IPC_SOCKET_NAME = 'discord-ipc';
const WINDOWS_IPC_PIPE_PATH = `\\\\?\\pipe\\${IPC_SOCKET_NAME}`;

const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env;
const UNIX_TEMP_DIR_FALLBACK = '/tmp';

// Helper to safely get the base prefix without realpathSync throwing ENOENT
const getPrefix = () => XDG_RUNTIME_DIR ?? TMPDIR ?? TMP ?? TEMP ?? UNIX_TEMP_DIR_FALLBACK;

const defaultPathList: PathData[] = [
  {
    platform: ['win32'],
    format: (id) => `${WINDOWS_IPC_PIPE_PATH}-${id}`,
  },
  // MacOS and Linux (Standard)
  {
    platform: ['darwin', 'linux'],
    format: (id) => join(getPrefix(), `${IPC_SOCKET_NAME}-${id}`),
  },
  // Linux (Snap)
  {
    platform: ['linux'],
    format: (id) => join(getPrefix(), 'snap.discord', `${IPC_SOCKET_NAME}-${id}`),
  },
];

// Linux (Flatpak) - Covers Stable, Canary, PTB, and Vesktop
const flatpakApps = ['com.discordapp.Discord', 'com.discordapp.DiscordCanary', 'com.discordapp.DiscordPTB', 'dev.vencord.Vesktop'];

for (const app of flatpakApps) {
  defaultPathList.push({
    platform: ['linux'],
    format: (id) => join(getPrefix(), 'app', app, `${IPC_SOCKET_NAME}-${id}`),
  });
}

export class SocketConnection implements Transport {
  private socket?: Socket;
  private buffer = Buffer.alloc(0);
  private messageCallback?: (message: TransportMessage) => void;
  private closeCallback?: () => void;

  async connect(clientId: string, index = 0): Promise<void> {
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
      return this.connect(clientId, index + 1);
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
            resolve(this.connect(clientId, index + 1));
          } else {
            reject(err);
          }
        });
      }
    });

  }

  // Wrap the existing private raw send in the public Transport methods:
  sendFrame(payload: object) {
    this.rawSend(OpCode.FRAME, payload);
  }

  ping(nonce: string) {
    this.rawSend(OpCode.PING, { nonce });
  }

  private rawSend(op: OpCode, payload: object) {
    const encoded = Buffer.from(JSON.stringify(payload));
    const header = Buffer.alloc(8);
    header.writeUInt32LE(op, 0);
    header.writeUInt32LE(encoded.length, 4);
    this.socket?.write(Buffer.concat([header, encoded]));
  }

  private setupBufferHandler() {
    this.socket?.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 8) {
        const op: OpCode = this.buffer.readUInt32LE(0);
        const len = this.buffer.readUInt32LE(4);
        if (this.buffer.length >= 8 + len) {
          const payload = JSON.parse(this.buffer.subarray(8, 8 + len).toString());
          this.messageCallback?.(this.normalize(op, payload));
          this.buffer = this.buffer.subarray(8 + len);
        } else break;
      }
    });
    this.socket?.on('close', () => this.closeCallback?.());
  }

  private normalize(op: OpCode, data: any): TransportMessage {
    if (op === OpCode.CLOSE) return { type: 'close', data };
    if (op === OpCode.PING) return { type: 'ping', data };
    return { type: 'frame', data };
  }

  onMessage(callback: (message: TransportMessage) => void) {
    this.messageCallback = callback;
  }

  onClose(callback: () => void) {
    this.closeCallback = callback;
  }

  destroy() {
    this.socket?.destroy();
  }

  setPathList(pathList: PathData[]) {
    for (const path of pathList) defaultPathList.unshift(path);
  }
}