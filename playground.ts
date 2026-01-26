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

const presence = new PresenceBuilder()
  .setDetails('Testing new-rpc library')
  .setState('In the playground')
  .setStartTimestamp(Date.now())
  .setLargeImage('whitesur', 'Icon');
client.setActivity(presence.build());

// // 1. Get a code from the UI
// const { code } = await client.authorize({ clientId: DISCORD_CLIENT_ID, scopes: ['rpc', 'identify'] });
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
