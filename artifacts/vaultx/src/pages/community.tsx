import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatUSDT } from "@/lib/format";
import {
  Megaphone, MessageCircle, Trophy, Headphones,
  Send, Trash2, Pin, Flag, Reply, X, ChevronRight,
  Crown, Shield, Star, TrendingUp, DollarSign, Users,
  AlertCircle, RefreshCw, CornerDownRight,
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

interface LeaderboardData {
  referrers: { rank: number; username: string; displayId: string | null; totalReferrals: number; totalEarned: number }[];
  investors: { rank: number; username: string; displayId: string | null; totalInvested: number; planCount: number }[];
  salaryEarners: { rank: number; username: string; displayId: string | null; totalPaid: number; currentTier: number | null }[];
}

type Tab = "announcements" | "chat" | "leaderboard" | "support";
type LeaderTab = "referrers" | "investors" | "salary";

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

function roleColor(role: string): string {
  if (role === "admin") return "text-amber-600";
  if (role === "moderator") return "text-blue-600";
  return "text-muted-foreground";
}

function roleBadge(role: string): string | null {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Mod";
  return null;
}

const EMOJI_LIST = ["👍", "❤️", "🔥", "💎", "🚀", "😂", "🙏", "💪"];

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
  const [showActions, setShowActions] = useState(false);
  const isOwn = msg.userId === currentUserId;
  const canModerate = isAdmin || msg.communityRole === "moderator";

  return (
    <div
      className={cn(
        "px-4 py-2.5 group hover:bg-muted/30 transition-colors",
        msg.isPinned && "border-l-2 border-amber-400 bg-amber-50/30 dark:bg-amber-950/10"
      )}
    >
      {msg.isPinned && (
        <p className="text-[9px] text-amber-600 font-semibold mb-1 flex items-center gap-1">
          <Pin size={9} /> Pinned
        </p>
      )}
      {msg.replyTo && (
        <div className="ml-0 mb-1 flex items-start gap-1.5 opacity-60">
          <CornerDownRight size={11} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="border-l-2 border-muted-foreground/40 pl-2 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground truncate">@{msg.replyTo.username}</p>
            <p className="text-[10px] text-muted-foreground truncate">{msg.replyTo.content}</p>
          </div>
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
          {msg.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">@{msg.username}</span>
            {msg.displayId && (
              <span className="text-[9px] text-muted-foreground">{msg.displayId}</span>
            )}
            {roleBadge(msg.communityRole) && (
              <span className={cn(
                "text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full",
                msg.communityRole === "admin"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              )}>
                {msg.communityRole === "admin" ? "Admin" : "Mod"}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
          </div>
          <p className={cn("text-sm leading-relaxed break-words", msg.isDeleted && "italic text-muted-foreground")}>
            {msg.content}
          </p>
          {msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => onReact(msg.id, r.emoji)}
                  className={cn(
                    "flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors",
                    r.userReacted
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setShowEmoji((v) => !v)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs"
            title="React"
          >
            😊
          </button>
          {!msg.isDeleted && (
            <button
              onClick={() => onReply(msg)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Reply"
            >
              <Reply size={11} />
            </button>
          )}
          {!msg.isDeleted && !isOwn && (
            <button
              onClick={() => onReport(msg.id)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Report"
            >
              <Flag size={11} />
            </button>
          )}
          {!msg.isDeleted && (isOwn || canModerate) && (
            <button
              onClick={() => onDelete(msg.id)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          )}
          {canModerate && !msg.isDeleted && (
            <button
              onClick={() => onPin(msg.id)}
              className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                msg.isPinned
                  ? "text-amber-500 hover:bg-amber-50"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={msg.isPinned ? "Unpin" : "Pin"}
            >
              <Pin size={11} />
            </button>
          )}
        </div>
      </div>
      {showEmoji && !msg.isDeleted && (
        <div className="ml-9 mt-1.5 flex flex-wrap gap-1">
          {EMOJI_LIST.map((em) => (
            <button
              key={em}
              onClick={() => { onReact(msg.id, em); setShowEmoji(false); }}
              className="text-base px-1 py-0.5 rounded-lg hover:bg-muted transition-colors"
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
  const qc = useQueryClient();
  const [messages, setMessages] = useState<MessageShape[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageShape | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(false);

  const loadMessages = useCallback(async (before?: number) => {
    try {
      const url = `/api/community/channels/${channel.id}/messages?limit=40${before ? `&before=${before}` : ""}`;
      const data = await apiGet<MessageShape[]>(url);
      if (before) {
        setMessages((prev) => [...data, ...prev]);
        setHasOlder(data.length === 40);
      } else {
        setMessages(data);
        setHasOlder(data.length === 40);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);
      }
    } catch {}
  }, [channel.id]);

  useEffect(() => {
    initialLoad.current = false;
    setMessages([]);
    setHasOlder(true);
    loadMessages();
  }, [channel.id, loadMessages]);

  useEffect(() => {
    if (!initialLoad.current && messages.length > 0) {
      initialLoad.current = true;
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages]);

  useEffect(() => {
    if (announcementMode && !isAdmin) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/ws/community`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: "join", channelId: channel.id }));
    };
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === "message") {
          setMessages((prev) => [...prev, payload.data]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        } else if (payload.type === "delete") {
          setMessages((prev) =>
            prev.map((m) => m.id === payload.messageId ? { ...m, isDeleted: true, content: "[Message removed]" } : m)
          );
        } else if (payload.type === "reaction") {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== payload.messageId) return m;
            const reactions = [...m.reactions];
            const idx = reactions.findIndex((r) => r.emoji === payload.emoji);
            if (idx >= 0) {
              if (payload.added) {
                reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userReacted: payload.userId === currentUserId ? true : reactions[idx].userReacted };
              } else {
                const newCount = reactions[idx].count - 1;
                if (newCount <= 0) reactions.splice(idx, 1);
                else reactions[idx] = { ...reactions[idx], count: newCount, userReacted: payload.userId === currentUserId ? false : reactions[idx].userReacted };
              }
            } else if (payload.added) {
              reactions.push({ emoji: payload.emoji, count: 1, userReacted: payload.userId === currentUserId });
            }
            return { ...m, reactions };
          }));
        } else if (payload.type === "pin") {
          setMessages((prev) => prev.map((m) => m.id === payload.messageId ? { ...m, isPinned: payload.isPinned } : m));
        }
      } catch {}
    };

    return () => {
      ws.send(JSON.stringify({ type: "leave", channelId: channel.id }));
      ws.close();
    };
  }, [channel.id, currentUserId, isAdmin, announcementMode]);

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
      toast({ title: "Failed to send", description: e?.message, variant: "destructive" });
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
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isDeleted: true, content: "[Message removed]" } : m));
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

  return (
    <div className="flex flex-col h-full">
      {hasOlder && (
        <div className="px-4 py-2 text-center border-b border-border">
          <button
            className="text-xs text-primary flex items-center gap-1 mx-auto"
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-border/50 overscroll-contain">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Megaphone size={28} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {announcementMode ? "No announcements yet." : "Be the first to say hello!"}
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
        <div ref={bottomRef} />
      </div>

      {canPost && !isLocked && (
        <div className="border-t border-border bg-background px-3 py-2 safe-area-inset-bottom">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <CornerDownRight size={12} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground">Replying to @{replyTo.username}</p>
                <p className="text-[10px] text-muted-foreground truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={announcementMode ? "Post an announcement…" : "Type a message…"}
              className="flex-1 h-9 text-sm rounded-xl"
              maxLength={2000}
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
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">
              {wsConnected ? "● Live" : "○ Connecting…"}
            </span>
            <span className="text-[9px] text-muted-foreground">{input.length}/2000</span>
          </div>
        </div>
      )}
      {isLocked && (
        <div className="border-t border-border px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">This channel is locked.</p>
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard pane ─────────────────────────────────────────────────────────

function LeaderboardPane() {
  const [lbTab, setLbTab] = useState<LeaderTab>("referrers");

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["community-leaderboard"],
    queryFn: () => apiGet("/api/community/leaderboard"),
    staleTime: 60000,
  });

  const lbTabs: { key: LeaderTab; label: string; icon: typeof TrendingUp }[] = [
    { key: "referrers", label: "Referrers", icon: Users },
    { key: "investors", label: "Investors", icon: TrendingUp },
    { key: "salary", label: "Salary", icon: DollarSign },
  ];

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={14} className="text-amber-500" />;
    if (rank === 2) return <Star size={14} className="text-slate-400" />;
    if (rank === 3) return <Star size={14} className="text-amber-700" />;
    return <span className="text-xs font-bold text-muted-foreground w-3.5 text-center">{rank}</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="sticky top-0 bg-background z-10 border-b border-border">
        <div className="flex">
          {lbTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setLbTab(key)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2",
                lbTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <RefreshCw size={18} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && lbTab === "referrers" && (
        <div className="divide-y divide-border/50">
          {(data?.referrers ?? []).length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No referral data yet.</div>
          )}
          {(data?.referrers ?? []).map((r) => (
            <div key={r.rank} className="flex items-center gap-3 px-4 py-3">
              <div className="w-6 flex items-center justify-center shrink-0">{rankIcon(r.rank)}</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center text-xs font-bold text-blue-600">
                {r.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">@{r.username}</p>
                {r.displayId && <p className="text-[10px] text-muted-foreground">{r.displayId}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-foreground">{r.totalReferrals} refs</p>
                <p className="text-[10px] text-emerald-600">{formatUSDT(r.totalEarned)} earned</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && lbTab === "investors" && (
        <div className="divide-y divide-border/50">
          {(data?.investors ?? []).length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No investor data yet.</div>
          )}
          {(data?.investors ?? []).map((r) => (
            <div key={r.rank} className="flex items-center gap-3 px-4 py-3">
              <div className="w-6 flex items-center justify-center shrink-0">{rankIcon(r.rank)}</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 flex items-center justify-center text-xs font-bold text-purple-600">
                {r.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">@{r.username}</p>
                {r.displayId && <p className="text-[10px] text-muted-foreground">{r.displayId}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-foreground">{formatUSDT(r.totalInvested)}</p>
                <p className="text-[10px] text-muted-foreground">{r.planCount} plan{r.planCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && lbTab === "salary" && (
        <div className="divide-y divide-border/50">
          {(data?.salaryEarners ?? []).length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No salary earners yet.</div>
          )}
          {(data?.salaryEarners ?? []).map((r) => (
            <div key={r.rank} className="flex items-center gap-3 px-4 py-3">
              <div className="w-6 flex items-center justify-center shrink-0">{rankIcon(r.rank)}</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 flex items-center justify-center text-xs font-bold text-amber-600">
                {r.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">@{r.username}</p>
                {r.displayId && <p className="text-[10px] text-muted-foreground">{r.displayId}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-amber-600">{formatUSDT(r.totalPaid)}</p>
                {r.currentTier && (
                  <p className="text-[10px] text-muted-foreground">Tier {r.currentTier}</p>
                )}
              </div>
            </div>
          ))}
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
      <div className="px-4 py-5 space-y-4">
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Headphones size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Community Support</p>
              <p className="text-[11px] text-muted-foreground">We're here to help</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Have a question or need help? Open a support ticket and our team will respond within 24 hours.
          </p>
          <Button
            size="sm"
            className="w-full mt-3 h-9 text-sm"
            onClick={() => setLocation("/support")}
          >
            Open Support Ticket
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: MessageCircle, label: "Live Chat", desc: "Chat with our team", color: "text-blue-500" },
            { icon: Shield, label: "Security", desc: "Report a security issue", color: "text-red-500" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <button
              key={label}
              onClick={() => setLocation("/support")}
              className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary/40 transition-colors"
            >
              <Icon size={18} className={cn("mb-2", color)} />
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
            </button>
          ))}
        </div>

        {channel && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <p className="text-sm font-semibold text-foreground">Community Help Channel</p>
              <p className="text-[11px] text-muted-foreground">Ask the community for quick help</p>
            </div>
            <ChatPane
              channel={channel}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </div>
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
    { key: "leaderboard", label: "Leaderboard", icon: Trophy },
    { key: "support", label: "Support", icon: Headphones },
  ];

  return (
    <AppLayout title="Community">
      <div className="flex flex-col h-full">
        <div className="border-b border-border bg-background sticky top-0 z-20">
          <div className="flex overflow-x-auto scrollbar-hide">
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
        </div>

        <div className="flex-1 overflow-hidden relative">
          {channelsLoading && (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={18} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {!channelsLoading && tab === "announcements" && (
            announcementChannel ? (
              <div className="h-full">
                {!isAdmin && (
                  <div className="px-4 py-2.5 bg-blue-50/50 dark:bg-blue-950/10 border-b border-blue-200/50 dark:border-blue-800/30">
                    <p className="text-[11px] text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                      <Megaphone size={11} />
                      Official announcements from the Wexora team.
                    </p>
                  </div>
                )}
                <div style={{ height: isAdmin ? "100%" : "calc(100% - 40px)" }}>
                  <ChatPane
                    channel={announcementChannel}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    announcementMode={true}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <AlertCircle size={24} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Announcements channel unavailable.</p>
              </div>
            )
          )}

          {!channelsLoading && tab === "chat" && (
            chatChannel ? (
              <div className="h-full">
                <ChatPane
                  channel={chatChannel}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <MessageCircle size={24} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Chat channel unavailable.</p>
              </div>
            )
          )}

          {!channelsLoading && tab === "leaderboard" && (
            <div className="h-full overflow-hidden">
              <LeaderboardPane />
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
      </div>
    </AppLayout>
  );
}
