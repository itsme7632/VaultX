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
  Shield, AlertCircle, RefreshCw, CornerDownRight,
  Wifi, WifiOff, Ticket, Lock, HelpCircle, Users,
  MoreHorizontal,
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

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const EMOJI_LIST = ["👍", "❤️", "🔥", "😂", "🎉", "👏", "💎", "🚀"];

function avatarColor(username: string): string {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600",
    "from-indigo-500 to-blue-600",
    "from-teal-500 to-green-600",
    "from-fuchsia-500 to-violet-600",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function UserAvatar({ username, size = "md" }: { username: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-xs";
  return (
    <div className={cn(
      "rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 font-bold text-white",
      avatarColor(username), sz
    )}>
      {username.slice(0, 1).toUpperCase()}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      <Shield size={7} /> Admin
    </span>
  );
  if (role === "moderator") return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
      <Shield size={7} /> Mod
    </span>
  );
  return null;
}

// ─── Announcement Card ────────────────────────────────────────────────────────

function AnnouncementCard({
  msg,
  currentUserId,
  isAdmin,
  onReact,
  onDelete,
  onPin,
}: {
  msg: MessageShape;
  currentUserId: number;
  isAdmin: boolean;
  onReact: (msgId: number, emoji: string) => void;
  onDelete: (msgId: number) => void;
  onPin: (msgId: number) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={cn(
      "mx-4 my-3 rounded-2xl border shadow-sm overflow-hidden transition-all",
      msg.isPinned
        ? "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/40"
        : "border-border bg-card"
    )}>
      {msg.isPinned && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-100/70 dark:bg-amber-900/30 border-b border-amber-200/50 dark:border-amber-700/30">
          <Pin size={10} className="text-amber-600" />
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Pinned Announcement</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <UserAvatar username={msg.username} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-sm text-foreground">@{msg.username}</span>
              <RoleBadge role={msg.communityRole} />
              <span className="text-[10px] text-muted-foreground ml-auto">{formatFullTime(msg.createdAt)}</span>
            </div>
            <p className={cn(
              "text-sm leading-relaxed break-words whitespace-pre-wrap",
              msg.isDeleted && "italic text-muted-foreground"
            )}>
              {msg.content}
            </p>
          </div>
          {isAdmin && !msg.isDeleted && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 z-10 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[130px]">
                  <button
                    onClick={() => { onPin(msg.id); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                  >
                    <Pin size={12} className="text-amber-500" />
                    {msg.isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => { onDelete(msg.id); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reactions */}
        {msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 ml-12">
            {msg.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(msg.id, r.emoji)}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all active:scale-95",
                  r.userReacted
                    ? "bg-primary/10 border-primary/40 text-primary font-medium"
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                )}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Emoji picker */}
        <div className="flex items-center gap-2 mt-2.5 ml-12">
          <button
            onClick={() => setShowEmoji((v) => !v)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            😊
          </button>
          {showEmoji && (
            <div className="flex flex-wrap gap-1">
              {EMOJI_LIST.map((em) => (
                <button
                  key={em}
                  onClick={() => { onReact(msg.id, em); setShowEmoji(false); }}
                  className="text-base px-1 py-0.5 rounded-lg hover:bg-muted transition-colors active:scale-95"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Message Bubble ──────────────────────────────────────────────────────

function ChatMessage({
  msg,
  currentUserId,
  isAdmin,
  prevMsg,
  onReact,
  onDelete,
  onPin,
  onReport,
  onReply,
}: {
  msg: MessageShape;
  currentUserId: number;
  isAdmin: boolean;
  prevMsg: MessageShape | null;
  onReact: (msgId: number, emoji: string) => void;
  onDelete: (msgId: number) => void;
  onPin: (msgId: number) => void;
  onReport: (msgId: number) => void;
  onReply: (msg: MessageShape) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isOwn = msg.userId === currentUserId;
  const canModerate = isAdmin || msg.communityRole === "moderator";

  // Group consecutive messages from same user (within 5 min)
  const isSameAuthor = prevMsg &&
    prevMsg.userId === msg.userId &&
    new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000;

  return (
    <div className={cn(
      "px-3 group",
      isSameAuthor ? "pt-0.5 pb-0" : "pt-3 pb-0",
      msg.isPinned && "bg-amber-50/30 dark:bg-amber-950/10 border-l-2 border-amber-400"
    )}>
      {msg.isPinned && !isSameAuthor && (
        <p className="text-[9px] text-amber-600 font-semibold mb-1 flex items-center gap-1 ml-11">
          <Pin size={8} /> Pinned
        </p>
      )}

      {msg.replyTo && (
        <div className="ml-11 mb-1 flex items-start gap-1.5 opacity-60">
          <CornerDownRight size={10} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="border-l-2 border-muted-foreground/40 pl-2 min-w-0 flex-1">
            <p className="text-[10px] font-medium text-muted-foreground">@{msg.replyTo.username}</p>
            <p className="text-[10px] text-muted-foreground truncate">{msg.replyTo.content}</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5">
        {/* Avatar — only show for first in group */}
        {!isSameAuthor ? (
          <UserAvatar username={msg.username} size="sm" />
        ) : (
          <div className="w-7 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {/* Header — only show for first in group */}
          {!isSameAuthor && (
            <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
              <span className={cn(
                "text-[13px] font-semibold",
                isOwn ? "text-primary" : "text-foreground"
              )}>
                @{msg.username}
              </span>
              {msg.displayId && (
                <span className="text-[9px] text-muted-foreground">{msg.displayId}</span>
              )}
              <RoleBadge role={msg.communityRole} />
              <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
            </div>
          )}

          {/* Content bubble */}
          <div className="relative inline-block max-w-full">
            <p className={cn(
              "text-[13px] leading-relaxed break-words whitespace-pre-wrap",
              msg.isDeleted && "italic text-muted-foreground text-xs"
            )}>
              {msg.content}
            </p>
            {isSameAuthor && (
              <span className="ml-2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(msg.createdAt)}
              </span>
            )}
          </div>

          {/* Reactions */}
          {msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => onReact(msg.id, r.emoji)}
                  className={cn(
                    "flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-all active:scale-95",
                    r.userReacted
                      ? "bg-primary/10 border-primary/30 text-primary font-medium"
                      : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {showEmoji && !msg.isDeleted && (
            <div className="mt-1 flex flex-wrap gap-1 p-2 bg-card border border-border rounded-xl shadow-sm max-w-xs">
              {EMOJI_LIST.map((em) => (
                <button
                  key={em}
                  onClick={() => { onReact(msg.id, em); setShowEmoji(false); }}
                  className="text-base px-1 py-0.5 rounded-lg hover:bg-muted transition-colors active:scale-95"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover actions */}
        <div className={cn(
          "flex items-center gap-0.5 shrink-0 transition-opacity",
          showEmoji || showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <button
            onClick={() => { setShowEmoji((v) => !v); setShowActions(false); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
          >
            😊
          </button>
          {!msg.isDeleted && (
            <button
              onClick={() => onReply(msg)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Reply size={12} />
            </button>
          )}
          {!msg.isDeleted && !isOwn && (
            <button
              onClick={() => onReport(msg.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Flag size={11} />
            </button>
          )}
          {!msg.isDeleted && (isOwn || canModerate) && (
            <button
              onClick={() => onDelete(msg.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 size={11} />
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
            >
              <Pin size={11} />
            </button>
          )}
        </div>
      </div>
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
      if (evt.code === 4001) return;
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
            if (prev.some((m) => m.id === payload.data.id)) return prev;
            const next = [...prev, payload.data];
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            return next;
          });
        } else if (payload.type === "delete") {
          setMessages((prev) =>
            prev.map((m) => m.id === payload.messageId ? { ...m, isDeleted: true, content: "[Message removed]" } : m)
          );
        } else if (payload.type === "reaction") {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== payload.messageId) return m;
              const reactions = [...m.reactions];
              const idx = reactions.findIndex((r) => r.emoji === payload.emoji);
              if (payload.added) {
                if (idx >= 0) {
                  reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userReacted: payload.userId === currentUserId ? true : reactions[idx].userReacted };
                } else {
                  reactions.push({ emoji: payload.emoji, count: 1, userReacted: payload.userId === currentUserId });
                }
              } else if (idx >= 0) {
                const newCount = reactions[idx].count - 1;
                if (newCount <= 0) reactions.splice(idx, 1);
                else reactions[idx] = { ...reactions[idx], count: newCount, userReacted: payload.userId === currentUserId ? false : reactions[idx].userReacted };
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
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
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
    try { await apiPost(`/api/community/messages/${msgId}/react`, { emoji }); } catch {}
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 py-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            {announcementMode ? (
              <>
                <Megaphone size={28} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No announcements yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Official announcements will appear here</p>
              </>
            ) : (
              <>
                <MessageCircle size={28} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Be the first to say hello! 👋</p>
              </>
            )}
          </div>
        )}

        {announcementMode ? (
          // Announcement card layout
          <div>
            {messages.map((msg) => (
              <AnnouncementCard
                key={msg.id}
                msg={msg}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onReact={handleReact}
                onDelete={handleDelete}
                onPin={handlePin}
              />
            ))}
          </div>
        ) : (
          // Chat bubble layout
          <div>
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                msg={msg}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                prevMsg={idx > 0 ? messages[idx - 1] : null}
                onReact={handleReact}
                onDelete={handleDelete}
                onPin={handlePin}
                onReport={handleReport}
                onReply={(m) => setReplyTo(m)}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input area */}
      {canPost && !isLocked && (
        <div className="border-t border-border bg-background px-3 pt-2 pb-safe pb-3 shrink-0">
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
              placeholder={announcementMode ? "Post an announcement…" : "Message…"}
              className="flex-1 h-10 text-sm rounded-xl bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
              maxLength={2000}
              autoComplete="off"
            />
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
            >
              <Send size={15} />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-0.5">
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
        <div className="border-t border-border px-4 py-3 text-center shrink-0 bg-muted/20">
          <div className="flex items-center justify-center gap-2">
            <Lock size={12} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Only admins can post announcements</p>
            <span className={cn("text-[9px] flex items-center gap-0.5", wsConnected ? "text-emerald-500" : "text-muted-foreground")}>
              <WsIcon size={8} />
              {wsConnected ? "Live" : "…"}
            </span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="border-t border-border px-4 py-3 text-center shrink-0">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock size={12} /> This channel is locked.
          </p>
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
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const faqs = [
    { q: "How do I make a deposit?", a: "Go to Deposit in the main menu, choose your preferred network, and send funds to the provided wallet address." },
    { q: "How long do withdrawals take?", a: "Withdrawals are typically processed within 24 hours. During high-volume periods it may take up to 48 hours." },
    { q: "How does the referral program work?", a: "You earn 5% commission on every investment made by users you refer. Commissions are credited automatically." },
    { q: "Is my investment secure?", a: "Yes. All funds are secured with industry-standard encryption and multi-signature wallet protection." },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-4 space-y-3">

        {/* Support options grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setLocation("/support")}
            className="bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Ticket size={18} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Open Ticket</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Get help from our team</p>
          </button>

          <button
            onClick={() => setLocation("/support")}
            className="bg-card border border-border rounded-2xl p-4 text-left hover:border-red-400/40 hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
              <Shield size={18} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">Security Issue</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Report security concerns</p>
          </button>
        </div>

        {/* FAQ Section */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
            <HelpCircle size={15} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Frequently Asked Questions</p>
          </div>
          <div className="divide-y divide-border">
            {faqs.map(({ q, a }, i) => (
              <div key={i}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <p className="text-xs font-medium text-foreground pr-3">{q}</p>
                  <ChevronRight
                    size={14}
                    className={cn("text-muted-foreground shrink-0 transition-transform", faqOpen === i && "rotate-90")}
                  />
                </button>
                {faqOpen === i && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Community Help Channel header */}
        {channel && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
              <Users size={15} className="text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Community Help</p>
                <p className="text-[10px] text-muted-foreground">Ask the community for quick assistance</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {channel && (
        <div className="flex-1 flex flex-col min-h-0 border-t border-border" style={{ minHeight: 280 }}>
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
      {/* Tab bar */}
      <div className="flex border-b border-border bg-background shrink-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors border-b-2",
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

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {channelsLoading && (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={18} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!channelsLoading && tab === "announcements" && (
          <div className="h-full flex flex-col">
            {isAdmin && (
              <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 shrink-0">
                <p className="text-[11px] text-primary flex items-center gap-1.5">
                  <Shield size={11} />
                  Admin — you can post and manage announcements
                </p>
              </div>
            )}
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
