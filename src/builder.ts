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
   * Sets the activity type.
   * @param type Activity type
   * @returns The PresenceBuilder instance
   */
  setType(type: ActivityType): this {
    this.payload.type = type;
    return this;
  }

  /**
   * Sets the details of the activity.
   * @param details Details string
   * @returns The PresenceBuilder instance
   */
  setDetails(details: string): this {
    this.payload.details = details;
    return this;
  }

  /**
   * Sets the state of the activity.
   * @param state State string
   * @returns The PresenceBuilder instance
   */
  setState(state: string): this {
    this.payload.state = state;
    return this;
  }

  /**
   * Sets the timestamps for the activity.
   * @param timestamps Timestamps object
   * @returns The PresenceBuilder instance
   */
  setTimestamps(timestamps: Timestamps): this {
    this.payload.timestamps = timestamps;
    return this;
  }

  /**
   * Sets the start timestamp for the activity.
   * @param date Start timestamp as a number (milliseconds since epoch) or Date object
   * @returns The PresenceBuilder instance
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
   * @param date End timestamp as a number (milliseconds since epoch) or Date object
   * @returns The PresenceBuilder instance
   */
  setEndTimestamp(date: number | Date): this {
    this.payload.timestamps = {
      ...this.payload.timestamps,
      end: date instanceof Date ? date.getTime() : date,
    };
    return this;
  }

  /**
   * Sets the assets for the activity.
   * @param assets Assets object
   * @returns The PresenceBuilder instance
   */
  setAssets(assets: Assets): this {
    this.payload.assets = assets;
    return this;
  }

  /**
   * Sets the large image for the activity.
   * @param key Image key
   * @param text Optional text for the large image
   * @returns The PresenceBuilder instance
   */
  setLargeImage(key: string, text?: string): this {
    this.payload.assets = { ...this.payload.assets, large_image: key, large_text: text };
    return this;
  }

  /**
   * Sets the small image for the activity.
   * @param key Image key
   * @param text Optional text for the small image
   * @returns The PresenceBuilder instance
   */
  setSmallImage(key: string, text?: string): this {
    this.payload.assets = { ...this.payload.assets, small_image: key, small_text: text };
    return this;
  }

  /**
   * Sets the party information for the activity.
   * @param id Party ID
   * @param current Current size of the party
   * @param max Maximum size of the party
   * @returns The PresenceBuilder instance
   */
  setParty(id: string, current: number, max: number): this {
    this.payload.party = { id, size: [current, max] };
    return this;
  }

  /**
   * Sets the secrets for the activity.
   * @param secrets Secrets object
   * @returns The PresenceBuilder instance
   */
  setSecrets(secrets: { join?: string; spectate?: string; match?: string }): this {
    this.payload.secrets = secrets;
    return this;
  }

  /**
   * Whether this activity is an instanced context, like a match.
   * @param instance Boolean indicating if the activity is an instance
   * @returns The PresenceBuilder instance
   */
  setInstance(instance: boolean): this {
    this.payload.instance = instance;
    return this;
  }

  /**
   * Sets buttons for the activity.
   * @param buttons Array of button objects with label and url
   * @returns The PresenceBuilder instance
   */
  setButtons(buttons: { label: string; url: string }[]): this {
    if (buttons.length > 2) {
      throw new Error('A maximum of 2 buttons are allowed.');
    }

    this.payload.buttons = buttons;
    return this;
  }

  /**
   * Adds a single button to the activity.
   * @param label Button label
   * @param url Button URL
   * @returns The PresenceBuilder instance
   */
  addButton(label: string, url: string): this {
    if (!this.payload.buttons) {
      this.payload.buttons = [];
    }
    if (this.payload.buttons.length >= 2) {
      throw new Error('A maximum of 2 buttons are allowed.');
    }
    this.payload.buttons.push({ label, url });
    return this;
  }

  /**
   * Builds and returns the final activity payload.
   * @returns The constructed ActivityPayload object
   */
  build(): ActivityPayload {
    return this.payload as ActivityPayload;
  }
}
