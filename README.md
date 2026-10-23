# Astra Chat API

Cloudflare Worker + SQLite-backed Durable Object for the Astra Chat website.

## Deploy
1. This repository contains the backend. Cloudflare Dashboard → Workers & Pages → create a Worker connected to this GitHub repository.
2. Ensure the deployment uses `wrangler.jsonc` and applies migration `v1` for the `ChatRoom` Durable Object.
3. Deploy. Your WebSocket endpoint is the Worker URL converted from `https://` to `wss://`, with `/ws` appended.
4. In the separate frontend repository, set `WORKER_WS_URL` in `index.html` to that endpoint.

## How it works
- All users join the same global room.
- WebSockets broadcast new messages live.
- The Durable Object stores the latest 100 messages.

## Limitations
This is a starter app, not a secure private messenger. Display names are not verified identities, and there is no login, private rooms, moderation, or strong anti-spam protection. Do not share private information. Never put API keys or secrets in frontend files.
