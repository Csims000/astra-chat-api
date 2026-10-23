import { DurableObject } from "cloudflare:workers";

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 100;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response("Astra Chat API is running.");
    }
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const id = env.CHAT_ROOM.idFromName("astra-global-room");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};

export class ChatRoom extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.ctx = ctx; this.env = env; }

  cleanUsername(value) {
    const name = String(value || "Guest").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
    return name || "Guest";
  }

  async fetch(request) {
    const url = new URL(request.url);
    const username = this.cleanUsername(url.searchParams.get("username"));
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ username });

    const history = (await this.ctx.storage.get("history")) || [];
    server.send(JSON.stringify({ type: "history", messages: history }));
    this.broadcast({ type: "system", text: username + " joined the chat.", time: new Date().toISOString() }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string") return;
    let incoming;
    try { incoming = JSON.parse(raw); } catch { return; }
    if (incoming.type !== "message" || typeof incoming.text !== "string") return;
    const text = incoming.text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    const attachment = ws.deserializeAttachment() || {};
    const message = {
      type: "message",
      username: this.cleanUsername(attachment.username),
      text,
      time: new Date().toISOString()
    };
    const history = (await this.ctx.storage.get("history")) || [];
    history.push(message);
    await this.ctx.storage.put("history", history.slice(-MAX_HISTORY));
    this.broadcast(message);
  }

  webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    this.broadcast({
      type: "system",
      text: this.cleanUsername(attachment.username) + " left the chat.",
      time: new Date().toISOString()
    });
  }

  webSocketError(ws) {
    try { ws.close(1011, "Connection error"); } catch {}
  }

  broadcast(data, except = null) {
    const payload = JSON.stringify(data);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      try { socket.send(payload); } catch { try { socket.close(1011, "Send failed"); } catch {} }
    }
  }
}