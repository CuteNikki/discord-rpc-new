import { SocketConnection } from './connection';
import type { ActivityPayload } from './types/activities';
import type { ReadyResponse } from './types/client';
import { OpCode } from './types/opcodes';

/**
 * Main RPC Client for managing Discord Rich Presence.
 */
export class Client {
  /**
   * Underlying Discord IPC connection
   */
  private connection = new SocketConnection();

  /**
   * Indicates if the client is ready (handshake complete)
   */
  private isReady = false;

  /**
   * Logs in to Discord and establishes the IPC connection.
   * @returns Promise that resolves when login is successful
   */
  async login({ clientId }: { clientId: string }): Promise<ReadyResponse> {
    await this.connection.connect();

    return new Promise((resolve, reject) => {
      // 1. Set up the listener for the READY event
      this.connection.onData((op, data) => {
        if (op === OpCode.FRAME && data.evt === 'READY') {
          this.isReady = true;
          resolve(data.data); // Return the user data to the caller
        }

        // Optional: handle errors/close during login
        if (op === OpCode.CLOSE) {
          reject(new Error('Connection closed by Discord during handshake'));
        }
      });

      // 2. Send the Handshake
      this.connection.send(OpCode.HANDSHAKE, {
        v: 1,
        client_id: clientId,
      });

      // 3. Send a heartbeat every 30 seconds to keep the connection alive
      setInterval(() => {
        this.connection.send(OpCode.PING, { nonce: crypto.randomUUID() });
      }, 30_000);
    });
  }

  /**
   * Destroys the RPC client and closes the IPC connection.
   * @returns Promise that resolves when the client is destroyed
   */
  async destroy() {
    // Clear the activity before closing
    try {
      this.connection.send(OpCode.FRAME, {
        cmd: 'SET_ACTIVITY',
        args: {
          pid: process.pid,
          activity: null,
        },
        nonce: crypto.randomUUID(),
      });

      // Wait a moment to ensure the message is sent before closing
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.connection.destroy();
    } catch (error) {
      throw new Error('Failed to destroy RPC client: ' + (error as Error).message);
    }
  }

  /**
   * Sets the Rich Presence activity for the user.
   * @param activity Activity payload to set
   * @returns void
   */
  setActivity(activity: ActivityPayload) {
    if (!this.isReady) {
      console.warn('Attempted to set activity before client was ready.');
      return;
    }

    this.connection.send(OpCode.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity,
      },
      nonce: crypto.randomUUID(),
    });
  }
}
