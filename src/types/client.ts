/**
 * Response from READY event
 */
export type ReadyResponse = {
  v: number;
  config: {
    cdn_host: string;
    api_endpoint: string;
    environment: string;
  };
  user: User;
};

/**
 * User object structure
 */
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

/**
 * Response from authorize method
 */
export type AuthorizeResponse = {
  code: string;
};

/**
 * Response from authenticate method
 */
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

/**
 * OAuth2 Scopes
 */
export enum Scope {
  Identify = 'identify',
  Email = 'email',
  Connections = 'connections',
  Guilds = 'guilds',
  GuildsJoin = 'guilds.join',
  GuildsMembersRead = 'guilds.members.read',
  GuildsChannelsRead = 'guilds.channels.read',
  GroupDMJoin = 'gdm.join',
  Bot = 'bot',
  RPC = 'rpc',
  RPCNotificationsRead = 'rpc.notifications.read',
  RPCVoiceRead = 'rpc.voice.read',
  RPCVoiceWrite = 'rpc.voice.write',
  RPCVideoRead = 'rpc.video.read',
  RPCVideoWrite = 'rpc.video.write',
  RPCScreenshareRead = 'rpc.screenshare.read',
  RPCScreenshareWrite = 'rpc.screenshare.write',
  RPCActivitiesWrite = 'rpc.activities.write',
  WebhookIncoming = 'webhook.incoming',
  MessagesRead = 'messages.read',
  ApplicationsBuildsUpload = 'applications.builds.upload',
  ApplicationsBuildsRead = 'applications.builds.read',
  ApplicationsCommands = 'applications.commands',
  ApplicationsEntitlements = 'applications.entitlements',
  ApplicationsStoreUpdate = 'applications.store.update',
  ActivitiesRead = 'activities.read',
  ActivitiesWrite = 'activities.write',
  ActivitiesInvitesWrite = 'activities.invites.write',
  RelationshipsRead = 'relationships.read',
  RelationshipsWrite = 'relationships.write',
  Voice = 'voice',
  DMChannelsRead = 'dm_channels.read',
  RoleConnectionsWrite = 'role_connections.write',
  PresencesRead = 'presences.read',
  PresencesWrite = 'presences.write',
  Openid = 'openid',
  DMChannelsMessagesRead = 'dm_channels.messages.read',
  DMChannelsMessagesWrite = 'dm_channels.messages.write',
  GatewayConnect = 'gateway.connect',
  AccountGlobalNameUpdate = 'account.global_name.update',
  PaymentSourcesCountryCode = 'payment_sources.country_code',
  SDKSocialLayerPresence = 'sdk.social_layer_presence',
  SDKSocialLayer = 'sdk.social_layer',
  LobbiesWrite = 'lobbies.write',
  ApplicationIdentitiesWrite = 'application.identities.write',
  ApplicationCommandsPermissionsUpdate = 'application.commands.permissions.update',
}
