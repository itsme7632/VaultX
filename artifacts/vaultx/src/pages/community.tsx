import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import {
  Megaphone, MessageCircle, Headphones,
  Send, Trash2, Pin, Flag, Reply, X, ChevronRight,
  Shield,
  AlertCircle, RefreshCw, CornerDownRight, Wifi, WifiOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: number;
  name: string;
  type: string;
  description: string;
  isLocked: boolean;
  sortOrder: number;
}

interface MessageShape {
  id: number;
  channelId: number;
  userId: number;
  username: string;
  displayId: string | null;
  communityRole: string;
  content: string;
  imageUrl: string | null;
  replyToId: number | null;
  replyTo: { id: number; username: string; content: string } | null;
  isDeleted: boolean;
  isPinned: boolean;
  isSystemMessage: boolean;
  reactions: { emoji: string; count: number; userReacted: boolean }[];
  createdAt: string;
}

type Tab = "announcements" | "chat" | "support";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function apiPost(path: string, body?: object): Promise<any> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(path: string): Promise<any> {
  const res = await fetch(path, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// iOS/Unicode-compatible standard emoji set (Part 4 requirement)
const EMOJI_LIST = ["👍", "❤️", "🔥", "😂", "🎉", "👏", "💎", "🚀"];

// ─── Message component ────────────────────────────────────────────────────────

function MessageItem({
  msg,
  currentUserId,
  isAdmin,
  onReact,
  onDelete,
  onPin,
  onReport,
  onReply,
}: {
  msg: MessageShape;
  currentUserId: number;
  isAdmin: boolean;
  onReact: (msgId: number, emoji: string) => void;
  onDelete: (msgId: number) => void;
  onPin: (msgId: number) => void;
  onReport: (msgId: number) => void;
  onReply: (msg: MessageShape) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const isOwn = msg.userId === currentUserId;
  const canModerate = isAdmin || msg.communityRole === "moderator";

  function roleBadge(role: string) {
    if (role === "admin") return { label: "Admin", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    if (role === "moderator") return { label: "Mod", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    return null;
  }

  const badge = roleBadge(msg.communityRole);

  return (
    <div
      className={cn(
        "px-4 py-2.5 group hover:bg-muted/30 transition-colors",
        msg.isPinned && "border-l-2 border-amber-400 bg-amber-50/30 dark:bg-amber-950/10"
      )}
    >
      {msg.isPinned && (
        <p className="text-[9px] text-amber-600 font-semibold mb-1 flex items-center gap-1">
          <Pin size={9} /> Pinned message
        </p>
      )}
      {msg.replyTo && (
        <div className="ml-0 mb-1.5 flex items-start gap-1.5 opacity-60">
          <CornerDownRight size={11} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="border-l-2 border-muted-foreground/40 pl-2 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground truncate">@{msg.replyTo.username}</p>
            <p className="text-[10px] text-muted-foreground truncate">{msg.replyTo.content}</p>
          </div>
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shrink-0 text-xs font-bold text-primary mt-0.5">
          {msg.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">@{msg.username}</span>
            {msg.displayId && (
              <span className="text-[9px] text-muted-foreground">{msg.displayId}</span>
            )}
            {badge && (
              <span className={cn("text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full", badge.cls)}>
                {badge.label}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
          </div>
          <p className={cn(
            "text-sm leading-relaxed break-words whitespace-pre-wrap",
            msg.isDeleted && "italic text-muted-foreground text-xs"
          )}>
            {msg.content}
          </p>
          {msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => onReact(msg.id, r.emoji)}
                  className={cn(
                    "flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors active:scale-95",
                    r.userReacted
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Action buttons — shown on hover (desktop) always shown on mobile touch */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setShowEmoji((v) => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
            title="React"
          >
            😊
          </button>
          {!msg.isDeleted && (
            <button
              onClick={() => onReply(msg)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Reply"
            >
              <Reply size={12} />
            </button>
          )}
          {!msg.isDeleted && !isOwn && (
            <button
              onClick={() => onReport(msg.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Report"
            >
              <Flag size={12} />
            </button>
          )}
          {!msg.isDeleted && (isOwn || canModerate) && (
            <button
              onClick={() => onDelete(msg.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
          {canModerate && !msg.isDeleted && (
            <button
              onClick={() => onPin(msg.id)}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                msg.isPinned
                  ? "text-amber-500 bg-amber-50 dark:bg-amber-950/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={msg.isPinned ? "Unpin" : "Pin"}
            >
              <Pin size={12} />
            </button>
          )}
        </div>
      </div>
      {showEmoji && !msg.isDeleted && (
        <div className="ml-9 mt-1.5 flex flex-wrap gap-1.5 p-2 bg-card border border-border rounded-xl shadow-sm">
          {EMOJI_LIST.map((em) => (
            <button
              key={em}
              onClick={() => { onReact(msg.id, em); setShowEmoji(false); }}
              className="text-lg px-1 py-0.5 rounded-lg hover:bg-muted transition-colors active:scale-95"
            >
              {em}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat channel component ───────────────────────────────────────────────────

function ChatPane({
  channel,
  currentUserId,
  isAdmin,
  announcementMode = false,
}: {
  channel: Channel;
  currentUserId: number;
  isAdmin: boolean;
  announcementMode?: boolean;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageShape[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageShape | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isUnmounted = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (beforeId?: number) => {
    try {
      const url = `/api/community/channels/${channel.id}/messages?limit=40${beforeId ? `&before=${beforeId}` : ""}`;
      const data = await apiGet<MessageShape[]>(url);
      if (beforeId) {
        setMessages((prev) => [...data, ...prev]);
        setHasOlder(data.length === 40);
      } else {
        setMessages(data);
        setHasOlder(data.length === 40);
        // Scroll to bottom on initial load
        setTimeout(() => {
          if (!initialScrollDone.current) {
            bottomRef.current?.scrollIntoView({ behavior: "instant" });
            initialScrollDone.current = true;
          }
        }, 80);
      }
    } catch {}
  }, [channel.id]);

  useEffect(() => {
    initialScrollDone.current = false;
    setMessages([]);
    setHasOlder(false);
    loadMessages();
  }, [channel.id, loadMessages]);

  // ── WebSocket with auto-reconnect ──────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (isUnmounted.current) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/ws/community`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmounted.current) { ws.close(); return; }
      setWsConnected(true);
      reconnectAttempts.current = 0;
      ws.send(JSON.stringify({ type: "join", channelId: channel.id }));
    };

    ws.onclose = (evt) => {
      setWsConnected(false);
      if (isUnmounted.current) return;
      // Don't reconnect on auth failure — session has expired or is invalid
      if (evt.code === 4001) return;
      // Exponential back-off: 1 s → 2 s → 4 s → 8 s → 16 s → capped at 30 s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30_000);
      reconnectAttempts.current = Math.min(reconnectAttempts.current + 1, 6);
      reconnectTimerRef.current = setTimeout(connectWS, delay);
    };

    ws.onerror = () => {};

    ws.onmessage = (evt) => {
      if (isUnmounted.current) return;
      try {
        const payload = JSON.parse(evt.data as string);

        if (payload.type === "message") {
          setMessages((prev) => {
            // Deduplicate: skip if ID already present
            if (prev.some((m) => m.id === payload.data.id)) return prev;
            const next = [...prev, payload.data];
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            return next;
          });
        } else if (payload.type === "delete") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.messageId
                ? { ...m, isDeleted: true, content: "[Message removed]" }
                : m
            )
          );
        } else if (payload.type === "reaction") {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== payload.messageId) return m;
              const reactions = [...m.reactions];
              const idx = reactions.findIndex((r) => r.emoji === payload.emoji);
              if (payload.added) {
                if (idx >= 0) {
                  reactions[idx] = {
                    ...reactions[idx],
                    count: reactions[idx].count + 1,
                    userReacted: payload.userId === currentUserId ? true : reactions[idx].userReacted,
                  };
                } else {
                  reactions.push({ emoji: payload.emoji, count: 1, userReacted: payload.userId === currentUserId });
                }
              } else if (idx >= 0) {
                const newCount = reactions[idx].count - 1;
                if (newCount <= 0) {
                  reactions.splice(idx, 1);
                } else {
                  reactions[idx] = {
                    ...reactions[idx],
                    count: newCount,
                    userReacted: payload.userId === currentUserId ? false : reactions[idx].userReacted,
                  };
                }
              }
              return { ...m, reactions };
            })
          );
        } else if (payload.type === "pin") {
          setMessages((prev) =>
            prev.map((m) => m.id === payload.messageId ? { ...m, isPinned: payload.isPinned } : m)
          );
        }
      } catch {}
    };
  }, [channel.id, currentUserId]);

  useEffect(() => {
    isUnmounted.current = false;
    connectWS();

    return () => {
      isUnmounted.current = true;
      // Cancel any pending reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Close WebSocket cleanly — prevent onclose from triggering reconnect
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: "leave", channelId: channel.id })); } catch {}
        }
        ws.close();
        wsRef.current = null;
      }
    };
  }, [channel.id, connectWS]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await apiPost(`/api/community/channels/${channel.id}/messages`, {
        content: text,
        replyToId: replyTo?.id ?? null,
      });
      setReplyTo(null);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to send";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (msgId: number, emoji: string) => {
    try { await apiPost(`/api/community/messages/${msgId}/react`, { emoji }); }
    catch {}
  };

  const handleDelete = async (msgId: number) => {
    try {
      await apiDelete(`/api/community/messages/${msgId}`);
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, isDeleted: true, content: "[Message removed]" } : m)
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  const handlePin = async (msgId: number) => {
    try { await apiPost(`/api/community/messages/${msgId}/pin`); }
    catch (e: any) { toast({ title: "Error", description: e?.message, variant: "destructive" }); }
  };

  const handleReport = async (msgId: number) => {
    try {
      await apiPost(`/api/community/messages/${msgId}/report`, { reason: "Inappropriate content" });
      toast({ title: "Reported", description: "Thank you. Our team will review this." });
    } catch {}
  };

  // Admin-only posting for announcement channel; all others can post in chat/support
  const canPost = !announcementMode || isAdmin;
  const isLocked = channel.isLocked && !isAdmin;

  const WsIcon = wsConnected ? Wifi : WifiOff;

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      {/* Load older */}
      {hasOlder && (
        <div className="px-4 py-2 text-center border-b border-border shrink-0">
          <button
            className="text-xs text-primary flex items-center gap-1 mx-auto hover:underline"
            onClick={async () => {
              setLoadingOlder(true);
              const oldest = messages[0]?.id;
              await loadMessages(oldest);
              setLoadingOlder(false);
            }}
            disabled={loadingOlder}
          >
            <RefreshCw size={10} className={loadingOlder ? "animate-spin" : ""} />
            Load older messages
          </button>
        </div>
      )}

      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-border/40 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Megaphone size={24} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {announcementMode ? "No announcements yet." : "Be the first to say hello! 👋"}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onReact={handleReact}
            onDelete={handleDelete}
            onPin={handlePin}
            onReport={handleReport}
            onReply={(m) => setReplyTo(m)}
          />
        ))}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Input area — only shown when user can post */}
      {canPost && !isLocked && (
        <div className="border-t border-border bg-background px-3 pt-2 pb-3 shrink-0">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5">
              <CornerDownRight size={11} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground">Replying to @{replyTo.username}</p>
                <p className="text-[10px] text-muted-foreground truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground ml-1">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder={announcementMode ? "Post an announcement…" : "Type a message…"}
              className="flex-1 h-9 text-sm rounded-xl"
              maxLength={2000}
              autoComplete="off"
            />
            <Button
              size="icon"
              className="h-9 w-9 rounded-xl shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
            >
              <Send size={14} />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-1 px-0.5">
            <span className={cn("text-[9px] flex items-center gap-1", wsConnected ? "text-emerald-500" : "text-muted-foreground")}>
              <WsIcon size={8} />
              {wsConnected ? "Live" : "Reconnecting…"}
            </span>
            <span className="text-[9px] text-muted-foreground">{input.length}/2000</span>
          </div>
        </div>
      )}

      {/* Read-only notice for regular users in announcement channel */}
      {announcementMode && !isAdmin && (
        <div className="border-t border-border px-4 py-2.5 text-center shrink-0 bg-muted/20">
          <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <Megaphone size={11} />
            Only admins can post announcements
            <span className={cn("ml-1 text-[9px] flex items-center gap-0.5", wsConnected ? "text-emerald-500" : "text-muted-foreground")}>
              <WsIcon size={8} />
              {wsConnected ? "Live" : "Reconnecting…"}
            </span>
          </p>
        </div>
      )}

      {isLocked && (
        <div className="border-t border-border px-4 py-2.5 text-center shrink-0">
          <p className="text-xs text-muted-foreground">🔒 This channel is locked.</p>
        </div>
      )}
    </div>
  );
}

// ─── Support pane ─────────────────────────────────────────────────────────────

function SupportPane({ channel, currentUserId, isAdmin }: {
  channel: Channel | null;
  currentUserId: number;
  isAdmin: boolean;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-4 space-y-4">
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Headphones size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Community Support</p>
              <p className="text-[11px] text-muted-foreground">We're here to help • 24/7</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Have a question or issue? Open a support ticket and our team will respond within 24 hours.
          </p>
          <Button
            size="sm"
            className="w-full h-9 text-sm"
            onClick={() => setLocation("/support")}
          >
            Open Support Ticket
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: MessageCircle, label: "Live Chat", desc: "Chat with our team", color: "text-blue-500" },
            { icon: Shield, label: "Security Issue", desc: "Report security concerns", color: "text-red-500" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <button
              key={label}
              onClick={() => setLocation("/support")}
              className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary/40 transition-colors active:scale-[0.98]"
            >
              <Icon size={18} className={cn("mb-2", color)} />
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {channel && (
        <div className="flex-1 flex flex-col border-t border-border min-h-0" style={{ minHeight: 300 }}>
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 shrink-0">
            <p className="text-xs font-semibold text-foreground">Community Help Channel</p>
            <p className="text-[10px] text-muted-foreground">Ask the community for quick assistance</p>
          </div>
          <div className="flex-1 min-h-0">
            <ChatPane
              channel={channel}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Community page ──────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("announcements");
  const currentUserId = (user as any)?.id ?? 0;
  const isAdmin = (user as any)?.isAdmin === true;

  const { data: channels = [], isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["community-channels"],
    queryFn: () => apiGet("/api/community/channels"),
    staleTime: 60000,
  });

  const announcementChannel = channels.find((c) => c.type === "announcement") ?? null;
  const chatChannel = channels.find((c) => c.type === "chat") ?? null;
  const supportChannel = channels.find((c) => c.type === "support") ?? null;

  const tabs: { key: Tab; label: string; icon: typeof Megaphone }[] = [
    { key: "announcements", label: "Announcements", icon: Megaphone },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "support", label: "Support", icon: Headphones },
  ];

  return (
    <AppLayout title="Community">
      {/* Fixed tab bar */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-hide shrink-0 bg-background">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2 shrink-0",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content area fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {channelsLoading && (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={18} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!channelsLoading && tab === "announcements" && (
          <div className="h-full flex flex-col">
            {!isAdmin && (
              <div className="px-4 py-2 bg-blue-50/60 dark:bg-blue-950/10 border-b border-blue-200/40 dark:border-blue-800/20 shrink-0">
                <p className="text-[11px] text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Megaphone size={11} />
                  Official announcements from the Wexora team
                </p>
              </div>
            )}
            <div className="flex-1 min-h-0">
              {announcementChannel ? (
                <ChatPane
                  channel={announcementChannel}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  announcementMode={true}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                  <AlertCircle size={24} className="text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Announcements channel unavailable.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!channelsLoading && tab === "chat" && (
          <div className="h-full">
            {chatChannel ? (
              <ChatPane
                channel={chatChannel}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <MessageCircle size={24} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Chat channel unavailable.</p>
              </div>
            )}
          </div>
        )}

        {!channelsLoading && tab === "support" && (
          <div className="h-full overflow-hidden">
            <SupportPane
              channel={supportChannel}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
