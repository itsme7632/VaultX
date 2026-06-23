import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { pool } from "@workspace/db";

const channelSubs = new Map<number, Set<{ ws: WebSocket; userId: number }>>();
const onlineUsers = new Map<number, number>();

export function getOnlineUserCount(): number {
  return onlineUsers.size;
}

function parseCookies(cookieHeader = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

async function getUserIdFromCookie(cookieHeader: string): Promise<number | null> {
  try {
    const cookies = parseCookies(cookieHeader);
    const rawSid = cookies["connect.sid"];
    if (!rawSid) return null;
    const sid = rawSid.replace(/^s:/, "").split(".")[0];
    if (!sid) return null;
    const { rows } = await pool.query(
      `SELECT sess FROM session WHERE sid = $1 AND expire > NOW() LIMIT 1`,
      [sid],
    );
    if (!rows.length) return null;
    const sess = typeof rows[0].sess === "string"
      ? JSON.parse(rows[0].sess)
      : rows[0].sess;
    return sess?.userId ?? null;
  } catch {
    return null;
  }
}

function removeFromChannel(channelId: number, ws: WebSocket): void {
  const subs = channelSubs.get(channelId);
  if (!subs) return;
  for (const sub of subs) {
    if (sub.ws === ws) { subs.delete(sub); break; }
  }
}

export function broadcastToChannel(channelId: number, payload: object, excludeUserId?: number): void {
  const subs = channelSubs.get(channelId);
  if (!subs || subs.size === 0) return;
  const data = JSON.stringify(payload);
  for (const sub of subs) {
    if (excludeUserId !== undefined && sub.userId === excludeUserId) continue;
    if (sub.ws.readyState === WebSocket.OPEN) {
      try { sub.ws.send(data); } catch {}
    }
  }
}

export function setupCommunityWS(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws/community" });

  wss.on("connection", async (ws, req) => {
    const userId = await getUserIdFromCookie(req.headers.cookie ?? "");
    if (!userId) { ws.close(4001, "Unauthorized"); return; }

    onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
    const myChannels = new Set<number>();

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "join" && msg.channelId) {
          const cid = Number(msg.channelId);
          myChannels.add(cid);
          if (!channelSubs.has(cid)) channelSubs.set(cid, new Set());
          channelSubs.get(cid)!.add({ ws, userId });
        } else if (msg.type === "leave" && msg.channelId) {
          const cid = Number(msg.channelId);
          myChannels.delete(cid);
          removeFromChannel(cid, ws);
        }
      } catch {}
    });

    ws.on("close", () => {
      for (const cid of myChannels) removeFromChannel(cid, ws);
      const n = (onlineUsers.get(userId) ?? 1) - 1;
      if (n <= 0) onlineUsers.delete(userId);
      else onlineUsers.set(userId, n);
    });

    ws.on("error", () => {});
  });
}
