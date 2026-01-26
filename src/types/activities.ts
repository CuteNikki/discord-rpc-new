export enum ActivityType {
  Playing = 0,
  Streaming = 1,
  Listening = 2,
  Watching = 3,
  Competing = 5,
}

export interface ActivityPayload {
  type: ActivityType;
  details?: string;
  state?: string;
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  timestamps?: {
    start?: number;
    end?: number;
  };
  instance?: boolean;
  buttons?: Array<{ label: string; url: string }>;
}
