/**
 * Timestamps for an activity.
 */
export interface Timestamps {
  start?: number;
  end?: number;
}

/**
 * Assets for an activity.
 */
export interface Assets {
  large_image?: string;
  large_text?: string;
  small_image?: string;
  small_text?: string;
}

/**
 * Party information for an activity.
 */
export interface Party {
  id?: string;
  /**
   * size[0] is current size, size[1] is max size
   * Example: [1, 5] for "1 of 5"
   */
  size?: [number, number];
}

/**
 * Secrets for an activity.
 */
export interface Secrets {
  join?: string;
  spectate?: string;
  match?: string;
}

/**
 * Enum for activity types.
 */
export enum ActivityType {
  Playing = 0,
  Streaming = 1,
  Listening = 2,
  Watching = 3,
  Competing = 5,
}

/**
 * Payload structure for an activity.
 */
export interface ActivityPayload {
  type?: ActivityType;
  state?: string;
  details?: string;
  timestamps?: Timestamps;
  assets?: Assets;
  party?: Party;
  secrets?: Secrets;
  instance?: boolean;
}
