// Libraries
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
// Internal
import { SocketConnection } from './connection';
// Types
import {
  Command,
  Event,
  LobbyType,
  OpCode,
  type ActivityPayload,
  type AuthenticateResponse,
  type AuthorizeResponse,
  type ClientOptions,
  type ReadyResponse,
} from './types';

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
   * Timer for attempting reconnection if the connection is lost
   */
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  /**
   * Stores the last activity payload for potential reconnection scenarios
   */
  private lastActivity?: ActivityPayload;

  /**
   * Initializes a new RPC Client instance.
   */
  constructor(options?: ClientOptions) {
    super();

    // Set custom path list if provided
    if (options?.pathList) {
      this.connection.setPathList(options.pathList);
    }

    // Centralized data handler
    this.connection.onData((op: OpCode, data: any) => {
      this.handleIncoming(op, data);
    });

    this.connection.onClose(() => {
      if (this.isReady) {
        this.isReady = false;
        this.emit('disconnected');
        this.attemptReconnect();
      }
    });
  }

  /**
   * Indicates whether the client is currently connected and ready to send/receive commands.
   * @returns boolean indicating connection status
   */
  public get isConnected() {
    return this.isReady;
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
      if (data.evt === Event.READY) {
        this.isReady = true;
        this.emit(Event.READY, data.data);

        if (this.lastActivity) {
          this.setActivity(this.lastActivity);
        }
      }

      if (data.evt === Event.ERROR) {
        this.emit(Event.ERROR, new Error(data.data.message));
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
    await this.connectWithRetry();

    return new Promise((resolve) => {
      this.once(Event.READY, (data) => {
        // Start heartbeat
        setInterval(() => this.ping(), 30_000);
        resolve(data);
      });
    });
  }

  /**
   * Attempts to reconnect to Discord with exponential backoff.
   */
  private async connectWithRetry() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    try {
      await this.connection.connect();
      // If we get here, we connected! Send Handshake immediately.
      this.connection.send(OpCode.HANDSHAKE, { v: 1, client_id: this.clientId });
    } catch (err) {
      console.log('Failed to connect to Discord. Retrying in 5s...');
      this.attemptReconnect();
    }
  }

  /**
   * Sets a timer to attempt reconnection after a delay if the connection is lost.
   */
  private attemptReconnect() {
    // Prevent multiple timers
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      this.connectWithRetry();
    }, 5_000);
  }

  /**
   * Destroys the RPC client and closes the IPC connection.
   * @returns Promise that resolves when the client is destroyed
   */
  async destroy() {
    // Prevent auto-reconnect logic from firing
    this.isReady = false;
    // Clear activity before destroying
    await this.clearActivity();
    // Destroy the underlying connection
    this.connection.destroy();
  }

  /**
   * Sends a ping to Discord to keep the connection alive.
   */
  ping() {
    this.connection.send(OpCode.PING, { nonce: randomUUID() });
  }

  /**
   * Sends a command request to Discord and waits for the response.
   * @param cmd Command to send
   * @param args Arguments for the command
   * @param evt Optional event name to listen for
   * @returns Promise that resolves with the command response
   */
  async request(cmd: Command, args?: object, evt?: Event): Promise<any> {
    const nonce = randomUUID();

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
      this.connection.send(OpCode.FRAME, { cmd, args, evt, nonce });
    });
  }

  /**
   * Authorizes the application and retrieves an authorization code.
   * @param param0 Object containing clientId and scopes
   * @returns Promise that resolves with the authorization code
   */
  async authorize({ clientId, scopes, args }: { clientId: string; scopes: string[]; args?: object }): Promise<AuthorizeResponse> {
    const data = await this.request(Command.AUTHORIZE, {
      client_id: clientId,
      scopes,
      ...args,
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
   * Subscribes to a specific event from Discord.
   * @param event Event name to subscribe to
   * @param args Optional arguments for the subscription
   * @returns Promise that resolves with an unsubscribe function
   */
  async subscribe(event: Event, args: object = {}): Promise<{ unsubscribe: () => Promise<void> }> {
    await this.request(Command.SUBSCRIBE, args, event);

    return {
      unsubscribe: async () => {
        await this.request(Command.UNSUBSCRIBE, args, event);
      },
    };
  }

  /**
   * Sets the Rich Presence activity for the user.
   * @param activity Activity payload to set
   * @returns void
   */
  setActivity(activity: ActivityPayload) {
    this.lastActivity = activity;

    if (!this.isReady) {
      console.warn('Attempted to set activity before client was ready.');
      return;
    }

    return this.request(Command.SET_ACTIVITY, { pid: process.pid ?? null, activity });
  }

  /**
   * Clears the current Rich Presence activity.
   * @returns void
   */
  clearActivity() {
    this.lastActivity = undefined;

    if (!this.isReady) {
      console.warn('Attempted to clear activity before client was ready.');
      return;
    }

    return this.request(Command.SET_ACTIVITY, { pid: process.pid ?? null, activity: null });
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

  /**
   * Retrieves the user's relationships.
   * @returns Promise that resolves with the user's relationships
   */
  getRelationships(): Promise<any> {
    return this.request(Command.GET_RELATIONSHIPS);
  }

  /**
   * Creates a new lobby.
   * @param type Lobby type (private or public)
   * @param capacity Maximum number of members in the lobby
   * @param metadata Additional metadata for the lobby
   * @returns Promise that resolves with the created lobby information
   */
  createLobby(type: LobbyType, capacity: number, metadata: object): Promise<any> {
    return this.request(Command.CREATE_LOBBY, {
      type,
      capacity,
      metadata,
    });
  }

  /**
   * Deletes a lobby by its ID.
   * @param lobbyId ID of the lobby to delete
   * @returns Promise that resolves when the lobby is deleted
   */
  deleteLobby(lobbyId: string): Promise<any> {
    return this.request(Command.DELETE_LOBBY, {
      id: lobbyId,
    });
  }

  /**
   * Updates a lobby's information.
   * @param lobbyId ID of the lobby to update
   * @param param1 Object containing optional update fields
   * @returns Promise that resolves with the updated lobby information
   */
  updateLobby(
    lobbyId: string,
    { type, ownerId, capacity, metadata }: { type?: LobbyType; ownerId?: string; capacity?: number; metadata?: object } = {},
  ): Promise<any> {
    return this.request(Command.UPDATE_LOBBY, {
      id: lobbyId,
      type,
      owner_id: ownerId,
      capacity,
      metadata,
    });
  }

  /**
   * Connects to a lobby using its ID and secret.
   * @param lobbyId ID of the lobby to connect to
   * @param secret Secret key for the lobby
   * @returns Promise that resolves when connected to the lobby
   */
  connectToLobby(lobbyId: string, secret: string): Promise<any> {
    return this.request(Command.CONNECT_TO_LOBBY, {
      id: lobbyId,
      secret,
    });
  }

  /**
   * Sends data to all members of a lobby.
   * @param lobbyId ID of the lobby
   * @param data Data to send to the lobby members
   * @returns Promise that resolves when the data is sent
   */
  sendToLobby(lobbyId: string, data: any): Promise<any> {
    return this.request(Command.SEND_TO_LOBBY, {
      id: lobbyId,
      data,
    });
  }

  /**
   * Disconnects from a lobby by its ID.
   * @param lobbyId ID of the lobby to disconnect from
   * @returns Promise that resolves when disconnected from the lobby
   */
  disconnectFromLobby(lobbyId: string): Promise<any> {
    return this.request(Command.DISCONNECT_FROM_LOBBY, {
      id: lobbyId,
    });
  }

  /**
   * Updates a lobby member's information.
   * @param lobbyId ID of the lobby
   * @param userId ID of the user/member
   * @param param2 Object containing optional update fields
   * @returns
   */
  updateLobbyMember(lobbyId: string, userId: string, { metadata }: { metadata?: object } = {}): Promise<any> {
    return this.request(Command.UPDATE_LOBBY_MEMBER, {
      lobby_id: lobbyId,
      user_id: userId,
      metadata,
    });
  }
}
