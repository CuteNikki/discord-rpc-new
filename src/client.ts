// Libraries
import { EventEmitter } from 'node:events';
// Internal
import { SocketConnection } from './connection';
// Types
import { Command, OpCode, type ActivityPayload, type AuthenticateResponse, type AuthorizeResponse, type ReadyResponse } from './types';

/**
 * Main RPC Client for managing Discord Rich Presence.
 */
export class Client extends EventEmitter {
  /**
   * Underlying Discord IPC connection
   */
  private connection = new SocketConnection();

  /**
   * Indicates if the client is ready (handshake complete)
   */
  private isReady = false;

  /**
   * The client ID of the Discord application
   */
  private clientId?: string;

  /**
   * Initializes a new RPC Client instance.
   */
  constructor() {
    super();

    // Centralized data handler
    this.connection.onData((op: OpCode, data: any) => {
      this.handleIncoming(op, data);
    });
  }

  /**
   * Handles incoming data from Discord.
   * @param op OpCode of the incoming message
   * @param data Payload data
   * @returns void
   */
  private handleIncoming(op: OpCode, data: any) {
    // 1. Handle Protocol-level events
    if (op === OpCode.CLOSE) {
      this.emit('disconnected', data);
      return;
    }

    if (op === OpCode.PING) {
      this.emit('ping', data);
      return;
    }

    // 2. Handle Frame-level events
    if (op === OpCode.FRAME) {
      // Emit the specific command/event type
      if (data.evt === 'READY') {
        this.isReady = true;
        this.emit('ready', data.data);
      }

      if (data.evt === 'ERROR') {
        this.emit('error', new Error(data.data.message));
      }

      // Emit everything else as general 'message' or by command name
      this.emit(data.cmd, data);
    }
  }

  /**
   * Logs in to Discord and establishes the IPC connection.
   * @returns Promise that resolves when login is successful
   */
  async login({
    clientId,
    clientSecret,
    scopes,
    accessToken,
  }: {
    clientId: string;
    clientSecret?: string;
    scopes?: string[];
    accessToken?: string;
  }): Promise<ReadyResponse> {
    this.clientId = clientId;
    await this.connection.connect();

    return new Promise((resolve, reject) => {
      this.once('ready', (data) => {
        // Start heartbeat
        setInterval(() => this.ping(), 30_000);
        resolve(data);
      });

      this.connection.send(OpCode.HANDSHAKE, { v: 1, client_id: clientId });
    });
  }

  /**
   * Destroys the RPC client and closes the IPC connection.
   * @returns Promise that resolves when the client is destroyed
   */
  async destroy() {
    // Clear activity before destroying
    this.connection.send(OpCode.FRAME, { cmd: Command.SET_ACTIVITY, args: { pid: process.pid, activity: null }, nonce: crypto.randomUUID() });
    // Wait a moment to ensure the message is sent before closing
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Destroy the underlying connection
    this.connection.destroy();
  }

  /**
   * Sends a ping to Discord to keep the connection alive.
   */
  ping() {
    this.connection.send(OpCode.PING, { nonce: crypto.randomUUID() });
  }

  /**
   * Sends a command request to Discord and waits for the response.
   * @param cmd Command to send
   * @param args Arguments for the command
   * @returns Promise that resolves with the command response
   */
  private async request(cmd: Command, args: object): Promise<any> {
    const nonce = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Create a specific handler for this command + nonce
      const handler = (data: any) => {
        if (data.nonce === nonce) {
          // Clean up: stop listening for this command once we find our nonce
          this.removeListener(cmd, handler);

          if (data.evt === 'ERROR') {
            reject(new Error(data.data.message));
          } else {
            resolve(data.data);
          }
        }
      };

      // Listen for the command event emitted by handleIncoming
      this.on(cmd, handler);

      // Send the frame to Discord
      this.connection.send(OpCode.FRAME, { cmd, args, nonce });
    });
  }

  /**
   * Authorizes the application and retrieves an authorization code.
   * @param param0 Object containing clientId and scopes
   * @returns Promise that resolves with the authorization code
   */
  async authorize({ clientId, scopes }: { clientId: string; scopes: string[] }): Promise<AuthorizeResponse> {
    const data = await this.request(Command.AUTHORIZE, {
      client_id: clientId,
      scopes,
    });
    return data;
  }

  /**
   * Authenticates the user with an access token.
   * @param accessToken Access token to authenticate with
   * @returns Promise that resolves with the authentication response
   */
  async authenticate(accessToken: string): Promise<AuthenticateResponse> {
    return this.request(Command.AUTHENTICATE, {
      access_token: accessToken,
    });
  }

  /**
   * Exchanges an authorization code for an access token.
   * @param param0 Object containing clientId, clientSecret, code, and redirectUri
   * @returns Promise that resolves with the access token response
   */
  async exchangeCode({
    clientId,
    clientSecret,
    code,
    redirectUri,
  }: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<{ access_token: string; scope: string; token_type: string }> {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to exchange code: ${JSON.stringify(error)}`);
    }

    return (await response.json()) as { access_token: string; scope: string; token_type: string };
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
      cmd: Command.SET_ACTIVITY,
      args: {
        pid: process.pid,
        activity,
      },
      nonce: crypto.randomUUID(),
    });
  }

  /**
   * Generates a URL for a user's avatar.
   * @param userId User's ID
   * @param avatarHash User's avatar hash
   * @param options Optional parameters for the avatar URL
   * @returns URL string for the user's avatar
   */
  getAvatarUrl(
    userId: string,
    avatarHash?: string | null,
    options?: { extension?: 'webp' | 'png' | 'gif' | 'jpeg'; size?: number; forceStatic?: boolean },
  ): string {
    let extension = options?.extension || 'png';
    const size = options?.size || 512;
    const forceStatic = options?.forceStatic || false;

    if (!avatarHash || avatarHash === 'default') {
      return `https://cdn.discordapp.com/embed/avatars/${(BigInt(userId) >> 22n) % 6n}.png`;
    }

    const isAnimated = avatarHash.startsWith('a_');
    // if is animated and not forcing static, use gif
    extension = isAnimated && !forceStatic ? 'gif' : extension;

    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=${size}`;
  }
}
