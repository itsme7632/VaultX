import { useState, useEffect } from "react";
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, Zap, Users, RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityType = "deposit" | "withdrawal" | "investment" | "earning" | "reinvest" | "referral";

interface FeedItem {
  id: string;
  type: ActivityType;
  username: string;
  flag: string;
  label: string;
  amount: number;
  ts: number;
  isReal?: boolean;
}

const USERNAMES = [
  "alex_v","cryptoMax","johnD","sarah_k","mike_t","emma_r","lucas_g",
  "mia_cx","noah_fx","olivia_v","liam_w","ava_trade","ethan_c",
  "sophia_b","mason_fx","isabella_t","james_v","charlie_k","aiden_m",
  "amelia_g","benny_r","evelyn_s","elijah_p","harper_t","oliver_c",
  "abigail_w","seb_v","henry_r","ella_m","jack_b","scarlett_g",
  "theo_f","grace_p","samuel_n","zoey_c","owen_v","penny_k",
  "lily_r","leo_m","chloe_b","dan_s","layla_v","riley_t",
  "grayson_c","nora_g","jaden_k","zara_fx","rayan_m","talia_v",
];

const FLAGS = [
  "🇺🇸","🇬🇧","🇦🇪","🇸🇦","🇮🇳","🇳🇬","🇰🇪","🇵🇰","🇩🇪","🇫🇷",
  "🇨🇦","🇦🇺","🇸🇬","🇲🇾","🇿🇦","🇧🇷","🇲🇽","🇪🇸","🇮🇹","🇯🇵",
  "🇹🇷","🇮🇩","🇵🇭","🇪🇬","🇬🇭","🇮🇶","🇹🇿","🇺🇬","🇪🇹","🇰🇼",
];

const PLANS = ["Starter Plan","Growth Plan","Elite Plan","Premium Plan","Pro Plan","Crypto Pro"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randAmt(min: number, max: number): number {
  const raw = min + Math.random() * (max - min);
  if (raw >= 5000) return Math.round(raw / 500) * 500;
  if (raw >= 1000) return Math.round(raw / 100) * 100;
  if (raw >= 100)  return Math.round(raw / 10)  * 10;
  return Math.round(raw);
}

function fmtAmt(n: number): string {
  return n >= 1_000 ? n.toLocaleString() : n < 10 ? n.toFixed(2) : String(n);
}

const TYPES: Array<{ type: ActivityType; w: number }> = [
  { type: "deposit",    w: 3 },
  { type: "investment", w: 3 },
  { type: "earning",    w: 5 },
  { type: "withdrawal", w: 2 },
  { type: "referral",   w: 2 },
  { type: "reinvest",   w: 2 },
];

function weightedType(): ActivityType {
  const total = TYPES.reduce((s, t) => s + t.w, 0);
  let r = Math.random() * total;
  for (const t of TYPES) { r -= t.w; if (r <= 0) return t.type; }
  return "earning";
}

function buildLabel(type: ActivityType, amount: number): string {
  switch (type) {
    case "deposit":    return `deposited ${fmtAmt(amount)} USDT`;
    case "withdrawal": return `withdrew ${fmtAmt(amount)} USDT`;
    case "investment": return `invested in ${pick(PLANS)}`;
    case "earning":    return `earned ${fmtAmt(amount)} USDT profit`;
    case "reinvest":   return `reinvested ${fmtAmt(amount)} USDT`;
    case "referral":   return `received ${fmtAmt(amount)} USDT referral bonus`;
  }
}

function buildRealLabel(type: string, amount: number): string {
  switch (type) {
    case "deposit":    return `deposited ${fmtAmt(amount)} USDT`;
    case "withdrawal": return `withdrew ${fmtAmt(amount)} USDT`;
    case "investment": return `started a new investment`;
    case "earning":    return `earned ${fmtAmt(amount)} USDT profit`;
    case "reinvest":   return `reinvested ${fmtAmt(amount)} USDT`;
    case "referral":   return `received ${fmtAmt(amount)} USDT referral bonus`;
    default:           return "completed a transaction";
  }
}

function genItem(tsOverride?: number): FeedItem {
  const type = weightedType();
  let amount: number;
  switch (type) {
    case "deposit":    amount = randAmt(200, 9500);  break;
    case "withdrawal": amount = randAmt(100, 5000);  break;
    case "investment": amount = randAmt(500, 15000); break;
    case "earning":    amount = randAmt(8, 800);     break;
    case "reinvest":   amount = randAmt(20, 600);    break;
    case "referral":   amount = randAmt(5, 250);     break;
  }
  return {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    username: pick(USERNAMES),
    flag: pick(FLAGS),
    label: buildLabel(type, amount),
    amount,
    ts: tsOverride ?? Date.now(),
  };
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)    return "just now";
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const TYPE_CFG: Record<ActivityType, {
  icon: React.ElementType;
  iconBg: string; iconColor: string;
  amountColor: string; prefix: string;
}> = {
  deposit:    { icon: ArrowDownLeft, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", amountColor: "text-emerald-600", prefix: "+" },
  withdrawal: { icon: ArrowUpRight,  iconBg: "bg-red-100",    iconColor: "text-red-500",     amountColor: "text-red-500",    prefix: "-" },
  investment: { icon: TrendingUp,    iconBg: "bg-blue-100",   iconColor: "text-blue-600",    amountColor: "text-blue-600",   prefix: ""  },
  earning:    { icon: Zap,           iconBg: "bg-amber-100",  iconColor: "text-amber-500",   amountColor: "text-emerald-600",prefix: "+" },
  reinvest:   { icon: RefreshCcw,    iconBg: "bg-purple-100", iconColor: "text-purple-600",  amountColor: "text-purple-600", prefix: ""  },
  referral:   { icon: Users,         iconBg: "bg-violet-100", iconColor: "text-violet-600",  amountColor: "text-emerald-600",prefix: "+" },
};

const MAX_ITEMS = 25;
const SHOW_ITEMS = 10;

export function LiveActivityFeed() {
  const [items, setItems]   = useState<FeedItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [tick, setTick]     = useState(0);
  const [totalTx, setTotal] = useState(0);

  const markNew = (id: string) => {
    setNewIds(prev => new Set([...prev, id]));
    setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 700);
  };

  useEffect(() => {
    const seed = Array.from({ length: 12 }, (_, i) => {
      const item = genItem(Date.now() - i * (25_000 + Math.random() * 45_000));
      item.id = `seed-${i}`;
      return item;
    });
    setItems(seed);
    setTotal(1_247 + seed.length);
  }, []);

  useEffect(() => {
    const fetchReal = async () => {
      try {
        const res = await fetch("/api/dashboard/live-activity", { credentials: "include" });
        if (!res.ok) return;
        const data: any[] = await res.json();
        if (!data.length) return;
        setItems(prev => {
          const existing = new Set(prev.map(i => i.id));
          const fresh: FeedItem[] = data
            .filter(d => !existing.has(d.id))
            .map(d => ({
              id: d.id,
              type: (d.type ?? "earning") as ActivityType,
              username: d.username,
              flag: pick(FLAGS),
              label: buildRealLabel(d.type, d.amount),
              amount: d.amount,
              ts: new Date(d.createdAt).getTime(),
              isReal: true,
            }));
          if (!fresh.length) return prev;
          return [...fresh, ...prev].sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
        });
      } catch { /* silent */ }
    };
    fetchReal();
    const id = setInterval(fetchReal, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        const item = genItem();
        setItems(prev => [item, ...prev].slice(0, MAX_ITEMS));
        setTotal(n => n + 1);
        markNew(item.id);
        schedule();
      }, 2_500 + Math.random() * 3_500);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
      <style>{`
        @keyframes feedIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .feed-new { animation: feedIn 0.35s cubic-bezier(.22,1,.36,1) forwards; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black text-emerald-600 tracking-[0.15em] uppercase">Live</span>
          </div>
          <div className="w-px h-3.5 bg-border" />
          <p className="text-[13px] font-semibold text-foreground">Platform Activity</p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1">
          <Zap size={9} className="text-amber-500" />
          <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
            {totalTx.toLocaleString()} txns
          </span>
        </div>
      </div>

      {/* ── Feed ───────────────────────────────────────────────────── */}
      <div className="divide-y divide-border/50">
        {items.slice(0, SHOW_ITEMS).map((item, idx) => {
          const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.earning;
          const Icon = cfg.icon;
          const isNew = newIds.has(item.id);
          const showAmt = item.type !== "investment";

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 transition-colors duration-300",
                isNew ? "feed-new bg-emerald-50/60" : idx === 0 ? "bg-slate-50/40" : "bg-white",
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                cfg.iconBg,
              )}>
                <Icon size={13} className={cfg.iconColor} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] leading-snug text-foreground">
                  <span className="font-bold">@{item.username}</span>
                  {" "}
                  <span className="text-muted-foreground">{item.label}</span>
                  {" "}<span className="text-[11px]">{item.flag}</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 tabular-nums">
                  {timeAgo(item.ts)}
                  {item.isReal && (
                    <span className="ml-1.5 text-[9px] text-emerald-500 font-semibold uppercase tracking-wide">verified</span>
                  )}
                </p>
              </div>

              {showAmt && (
                <p className={cn(
                  "text-[12.5px] font-bold shrink-0 tabular-nums",
                  cfg.amountColor,
                )}>
                  {cfg.prefix}{fmtAmt(item.amount)}
                  <span className="text-[9px] font-semibold ml-0.5 opacity-70">USDT</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-t border-border flex items-center justify-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="text-[10px] text-muted-foreground">Updating live · Global real-time feed</span>
      </div>
    </div>
  );
}
