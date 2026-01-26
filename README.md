# `discord-rpc-new`

A lightweight, high-performance **Discord RPC** client built from the ground up for **Bun** and **Node.js**. Rewritten with modern TypeScript, full typings, and zero external dependencies.

## 🚀 Features

- **Runtime Agnostic:** First-class support for Bun (using `.ts` source) and Node.js (via ESM).
- **Fully Typed:** Complete TypeScript interfaces for Activities, Assets, and Opcodes.
- **Zero Dependencies:** Uses native IPC pipes/sockets for maximum efficiency.
- **Graceful Handling:** Built-in support for packet fragmentation and clean shutdowns.

## 📦 Installation

```bash
# Using Bun
bun add discord-rpc-new

# Using npm
npm install discord-rpc-new
```

## 🛠️ Quick Start

```typescript
import { Client, ActivityPayload, ActivityType, PresenceBuilder } from 'discord-rpc-new';

// Environment variable for Discord Client ID
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
if (!DISCORD_CLIENT_ID) throw new Error('DISCORD_CLIENT_ID is not set in environment variables.');

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

// Example activity payload
const activity = new PresenceBuilder()
  .setType(ActivityType.Playing)
  .setDetails('Testing new PresenceBuilder')
  .setState('In a flow state')
  .setLargeImage('some-image', 'Hover Text!')
  .setStartTimestamp(Date.now())
  .build();
client.setActivity(activity);
```

Advanced: Full OAuth2 Flow:

```ts
// 1. Get Authorization Code
const { code } = await client.authorize({
  clientId: DISCORD_CLIENT_ID,
  scopes: ['identify', 'rpc'],
});

// 2. Exchange for Access Token
const { access_token } = await client.exchangeCode({
  clientId: DISCORD_CLIENT_ID,
  clientSecret: DISCORD_CLIENT_SECRET,
  code,
});

// 3. Authenticate Session
const auth = await client.authenticate(access_token);
console.log(`Authenticated application: ${auth.application.name}`);
```

---

## 🏗️ Technical Architecture

The library communicates directly with the Discord Desktop client via **Inter-Process Communication (IPC)**. It automatically detects the operating system to choose between Named Pipes (Windows) and Unix Sockets (Linux/macOS/WSL).

### Protocol Header

Every packet sent follows the Discord IPC binary format:

| Offset | Type      | Description                               |
| ------ | --------- | ----------------------------------------- |
| `0`    | `Int32LE` | **OpCode** (Handshake, Frame, Ping, etc.) |
| `4`    | `Int32LE` | **Length** of the JSON payload            |
| `8`    | `JSON`    | The actual data payload                   |

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
