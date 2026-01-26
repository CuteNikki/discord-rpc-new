export type ReadyResponse = {
  v: number;
  config: {
    cdn_host: string;
    api_endpoint: string;
    environment: string;
  };
  user: {
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
};
