import { PresenceBuilder } from './src/builder.js';
import { Client } from './src/client.js';

// Environment variable for Discord Client ID
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
if (!DISCORD_CLIENT_ID) throw new Error('DISCORD_CLIENT_ID is not set in environment variables.');
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
if (!DISCORD_CLIENT_SECRET) throw new Error('DISCORD_CLIENT_SECRET is not set in environment variables.');

const client = new Client();

// Gracefully shuts down the RPC client on process termination.
const shutdown = async () => {
  console.log('Shutting down RPC client...');
  await client.destroy();
  console.log('RPC client destroyed. Exiting.');
  process.exit(0);
};
// Handle termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Login and print user info
const response = await client.login({ clientId: DISCORD_CLIENT_ID });
console.log('Logged in as:', response.user.username);

// console.log('User Default Avatar URL:', client.getAvatarUrl(response.user.id));
// console.log('User Custom Avatar URL:', client.getAvatarUrl(response.user.id, response.user.avatar, { extension: 'webp', size: 512, forceStatic: false }));

const presence = new PresenceBuilder()
  .setDetails('Testing new-rpc library')
  .setState('In the playground')
  .setStartTimestamp(Date.now())
  .setLargeImage('whitesur', 'Icon')
  .setParty('party1234', 1, 4);
// .setSecrets({ join: 'party1234_join' })
// .addButton('Join Party', 'https://example.com/join');
client.setActivity(presence.build());

// // 1. Get a code from the UI
// const { code } = await client.authorize({
//   clientId: DISCORD_CLIENT_ID,
//   scopes: [Scope.RPC, Scope.Identify],
//   args: { prompt: 'none' },
// });
// console.log('Authorization code:', code);

// // 2. Exchange the code for a token
// const { access_token } = await client.exchangeCode({
//   clientId: DISCORD_CLIENT_ID,
//   clientSecret: DISCORD_CLIENT_SECRET,
//   redirectUri: 'http://localhost', // Ensure this matches the redirect URI used during authorization
//   code,
// });
// console.log('Exchanged code for access token:', access_token);

// // 3. Authenticate with the code to get an access token
// const authResponse = await client.authenticate(access_token);
// console.log('Authenticated as:', authResponse);

// const relationships = await client.getRelationships();
// console.log('User Relationships:', relationships);

// // Subscribe to activity join requests
// const { unsubscribe } = await client.subscribe(Event.ACTIVITY_JOIN_REQUEST);
// console.log('Subscribed to ACTIVITY_JOIN_REQUEST events.');

// client.on(Event.ACTIVITY_JOIN_REQUEST, async (data) => {
//   console.log('Activity Join Request Data:', data);
//   console.log('Received activity join request from:', data.user.username);
//   // Automatically accept the join request
//   await client.request(Command.CLOSE_ACTIVITY_JOIN_REQUEST, { user_id: data.user.id });
//   console.log('Accepted activity join request from:', data.user.username);
//   await unsubscribe();
//   console.log('Unsubscribed from ACTIVITY_JOIN_REQUEST events.');
// });
