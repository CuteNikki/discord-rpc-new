export type ReadyResponse = {
  v: number;
  config: {
    cdn_host: string;
    api_endpoint: string;
    environment: string;
  };
  user: User;
};

export type User = {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  avatar_decoration_data?: {
    asset: string;
    skuId: string;
  };
  bot?: boolean;
  flags?: number;
  premium_type?: number;
};

export type AuthorizeResponse = {
  code: string;
};

export type AuthenticateResponse = {
  application: {
    id: string;
    name: string;
    icon: string | null;
    description: string;
  };
  bot: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
  expires: string;
  user: User;
  scopes: string[];
  access_token: string;
};
