import type { ActivityPayload, ActivityType, Assets, Timestamps } from './types';

/**
 * Builder class for constructing Discord Rich Presence activity payloads.
 */
export class PresenceBuilder {
  /**
   * Internal payload being constructed
   */
  private payload: Partial<ActivityPayload> = {};

  /**
   * Sets the activity type (eg. Playing, Streaming, Listening, Watching).
   * @param type Activity type as defined by Discord (0-5)
   * @returns The PresenceBuilder instance for chaining
   */
  setType(type: ActivityType): this {
    this.payload.type = type;
    return this;
  }

  /**
   * Sets the details of the activity.
   * @param details Details string (Max 128 chars)
   * @returns The PresenceBuilder instance for chaining
   * @throws Error if details exceed character limit
   */
  setDetails(details: string): this {
    if (details.length > 128) {
      throw new Error('Details must be 128 characters or fewer.');
    }
    this.payload.details = details;
    return this;
  }

  /**
   * Sets the state of the activity.
   * @param state State string (Max 128 chars)
   * @returns The PresenceBuilder instance for chaining
   * @throws Error if state exceeds character limit
   */
  setState(state: string): this {
    if (state.length > 128) {
      throw new Error('State must be 128 characters or fewer.');
    }
    this.payload.state = state;
    return this;
  }

  /**
   * Sets the timestamps object directly.
   * @param timestamps Timestamps object with start and end times
   * @returns The PresenceBuilder instance for chaining
   */
  setTimestamps(timestamps: Timestamps): this {
    this.payload.timestamps = timestamps;
    return this;
  }

  /**
   * Sets the start timestamp for the activity.
   * @param date Start time as a Date object or Unix timestamp
   * @returns The PresenceBuilder instance for chaining
   */
  setStartTimestamp(date: number | Date): this {
    this.payload.timestamps = {
      ...this.payload.timestamps,
      start: date instanceof Date ? date.getTime() : date,
    };
    return this;
  }

  /**
   * Sets the end timestamp for the activity.
   * @param date End time as a Date object or Unix timestamp
   * @returns The PresenceBuilder instance for chaining
   */
  setEndTimestamp(date: number | Date): this {
    this.payload.timestamps = {
      ...this.payload.timestamps,
      end: date instanceof Date ? date.getTime() : date,
    };
    return this;
  }

  /**
   * Sets the assets object directly.
   * @param assets Assets object with large_image, small_image, etc.
   * @returns The PresenceBuilder instance for chaining
   * @throws Error if any text fields exceed character limits
   */
  setAssets(assets: Assets): this {
    if (assets.large_text && assets.large_text.length > 128) {
      throw new Error('Large text must be 128 characters or fewer.');
    }
    if (assets.small_text && assets.small_text.length > 128) {
      throw new Error('Small text must be 128 characters or fewer.');
    }
    this.payload.assets = assets;
    return this;
  }

  /**
   * Sets the large image for the activity.
   * @param key The key of the large image asset (defined in your Discord application)
   * @param text Optional tooltip text for the large image (Max 128 chars)
   * @returns The PresenceBuilder instance for chaining
   * @throws Error if text exceeds character limit
   */
  setLargeImage(key: string, text?: string): this {
    if (text && text.length > 128) {
      throw new Error('Large image text must be 128 characters or fewer.');
    }
    this.payload.assets = {
      ...this.payload.assets,
      large_image: key,
      large_text: text,
    };
    return this;
  }

  /**
   * Sets the small image for the activity.
   * @param key The key of the small image asset (defined in your Discord application)
   * @param text Optional tooltip text for the small image (Max 128 chars)
   * @returns The PresenceBuilder instance for chaining
   * @throws Error if text exceeds character limit
   */
  setSmallImage(key: string, text?: string): this {
    if (text && text.length > 128) {
      throw new Error('Small image text must be 128 characters or fewer.');
    }
    this.payload.assets = {
      ...this.payload.assets,
      small_image: key,
      small_text: text,
    };
    return this;
  }

  /**
   * Sets the party information for the activity.
   * @param id Unique ID for the party
   * @param current Current size of the party
   * @param max Maximum size of the party
   * @returns The PresenceBuilder instance for chaining
   */
  setParty(id: string, current: number, max: number): this {
    if (this.payload.buttons?.length) {
      throw new Error('Discord RPC does not display Buttons if Party or Secrets are present. Cannot set Party.');
    }
    this.payload.party = { id, size: [current, max] };
    return this;
  }

  /**
   * Sets the secrets for the activity.
   * @param secrets Object containing join, spectate, and match secrets
   * @returns The PresenceBuilder instance for chaining
   */
  setSecrets(secrets: { join?: string; spectate?: string; match?: string }): this {
    if (this.payload.buttons?.length) {
      throw new Error('Discord RPC does not display Buttons if Party or Secrets are present. Cannot set Secrets.');
    }
    this.payload.secrets = secrets;
    return this;
  }

  /**
   * Whether this activity is an instanced context, like a match.
   * @param instance Boolean indicating if this is an instanced activity
   * @returns The PresenceBuilder instance for chaining
   */
  setInstance(instance: boolean): this {
    this.payload.instance = instance;
    return this;
  }

  /**
   * Sets buttons for the activity.
   * Also, buttons will not display if Party or Secrets are present due to Discord RPC limitations.
   * @param buttons Array of button objects with label and url
   * @returns The PresenceBuilder instance for chaining
   * @throws Error if button constraints are violated or if Party/Secrets are present
   */
  setButtons(buttons: { label: string; url: string }[]): this {
    if (buttons.length > 2) {
      throw new Error('A maximum of 2 buttons are allowed.');
    }
    if (this.payload.party || this.payload.secrets) {
      throw new Error('Discord RPC does not display Buttons if Party or Secrets are present. Buttons may be ignored.');
    }
    for (const btn of buttons) {
      this.validateButton(btn.label, btn.url);
    }
    this.payload.buttons = buttons;
    return this;
  }

  /**
   * Adds a single button to the activity.
   * @param label Button label (Max 32 chars)
   * @param url Button URL (Max 512 chars)
   * @returns The PresenceBuilder instance for chaining
   * @throws Error if button constraints are violated or if Party/Secrets are present
   */
  addButton(label: string, url: string): this {
    if (!this.payload.buttons) {
      this.payload.buttons = [];
    }
    if (this.payload.buttons.length >= 2) {
      throw new Error('A maximum of 2 buttons are allowed.');
    }

    this.validateButton(label, url);
    this.payload.buttons.push({ label, url });
    return this;
  }

  /**
   * Builds and returns the final activity payload. Performs final conflict checks.
   * @returns The constructed ActivityPayload ready to be sent to Discord
   */
  build(): ActivityPayload {
    if (this.payload.buttons?.length && (this.payload.party || this.payload.secrets)) {
      throw new Error('Discord RPC does not display Buttons if Party or Secrets are present. Buttons may be ignored.');
    }

    return this.payload as ActivityPayload;
  }

  /**
   * Internal helper to validate button constraints.
   * @param label Button label (Max 32 chars)
   * @param url Button URL (Max 512 chars)
   * @throws Error if validation fails
   */
  private validateButton(label: string, url: string) {
    if (label.length > 32) throw new Error('Button label must be 32 characters or fewer.');
    if (url.length > 512) throw new Error('Button URL must be 512 characters or fewer.');
  }
}
