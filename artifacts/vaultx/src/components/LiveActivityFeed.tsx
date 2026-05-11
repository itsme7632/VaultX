import { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, Zap, Users,
  RefreshCcw, Star, Award, Trophy, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActivityType =
  | "deposit" | "withdrawal" | "investment" | "earning"
  | "reinvest" | "referral" | "staking" | "vip_upgrade"
  | "profit_claimed" | "auto_compound" | "invest_complete";

interface FeedItem {
  id: string;
  type: ActivityType;
  username: string;
  flag: string;
  action: string;
  rightLabel: string;
  rightSub: string;
  amount: number;
  ts: number;
  isReal?: boolean;
}

// ─── Module-level persistent cache (survives tab switches) ────────────────────
const cache = {
  items:       [] as FeedItem[],
  volume:      0,
  online:      0,
  totalTx:     0,
  initialized: false,
};

// ─── Static pools ─────────────────────────────────────────────────────────────
const USERNAMES = [
  "alex_v","cryptoMax","johnD","sarah_k","mike_t","emma_r","lucas_g",
  "mia_cx","noah_fx","olivia_v","liam_w","ava_trade","ethan_c",
  "sophia_b","mason_fx","isabella_t","james_v","charlie_k","aiden_m",
  "amelia_g","benny_r","evelyn_s","elijah_p","harper_t","oliver_c",
  "abigail_w","seb_v","henry_r","ella_m","jack_b","scarlett_g",
  "theo_f","grace_p","samuel_n","zoey_c","owen_v","penny_k",
  "lily_r","leo_m","chloe_b","dan_s","layla_v","riley_t",
  "grayson_c","nora_g","jaden_k","zara_fx","rayan_m","talia_v",
  "kim_p","marcos_v","felix_r","priya_k","omar_t","yuki_m",
];

const FLAGS = [
  "🇺🇸","🇬🇧","🇦🇪","🇸🇦","🇮🇳","🇳🇬","🇰🇪","🇵🇰","🇩🇪","🇫🇷",
  "🇨🇦","🇦🇺","🇸🇬","🇲🇾","🇿🇦","🇧🇷","🇲🇽","🇪🇸","🇮🇹","🇯🇵",
  "🇹🇷","🇮🇩","🇵🇭","🇪🇬","🇬🇭","🇮🇶","🇹🇿","🇺🇬","🇪🇹","🇰🇼",
  "🇳🇱","🇸🇪","🇵🇱","🇦🇷","🇨🇴","🇨🇱","🇷🇴","🇨🇿","🇧🇩","🇻🇳",
];

const PLANS       = ["Starter Plan","Growth Plan","Elite Plan","Premium Plan","Pro Plan","Crypto Pro"];
const STAKE_ASSETS= ["ETH","BTC","SOL","BNB","MATIC","AVAX"];
const VIP_TIERS   = ["Silver VIP","Gold VIP","Platinum VIP","Diamond VIP"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function randAmt(min: number, max: number): number {
  const raw = min + Math.random() * (max - min);
  if (raw >= 10_000) return Math.round(raw / 1000) * 1000;
  if (raw >= 5_000)  return Math.round(raw / 500)  * 500;
  if (raw >= 1_000)  return Math.round(raw / 100)  * 100;
  if (raw >= 100)    return Math.round(raw / 10)   * 10;
  return Math.round(raw);
}

function fmtAmt(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000)  return n.toLocaleString();
  if (n < 10)      return n.toFixed(2);
  return String(n);
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtOnline(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)    return "just now";
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function initVolume() {
  const v = 1_200_000 + Math.random() * 3_600_000;
  cache.volume = v;
  return v;
}

function initOnline() {
  const o = 1_200 + Math.floor(Math.random() * 1_200);
  cache.online = o;
  return o;
}

// ─── Activity generation ──────────────────────────────────────────────────────
const WEIGHTED_TYPES: Array<{ type: ActivityType; w: number }> = [
  { type: "earning",        w: 5 },
  { type: "deposit",        w: 4 },
  { type: "investment",     w: 3 },
  { type: "profit_claimed", w: 3 },
  { type: "withdrawal",     w: 2 },
  { type: "referral",       w: 2 },
  { type: "reinvest",       w: 2 },
  { type: "staking",        w: 2 },
  { type: "invest_complete",w: 2 },
  { type: "auto_compound",  w: 1 },
  { type: "vip_upgrade",    w: 1 },
];
const W_TOTAL = WEIGHTED_TYPES.reduce((s, t) => s + t.w, 0);

function weightedType(): ActivityType {
  let r = Math.random() * W_TOTAL;
  for (const t of WEIGHTED_TYPES) { r -= t.w; if (r <= 0) return t.type; }
  return "earning";
}

function buildItem(type: ActivityType, ts: number, id: string, username?: string, flagOvr?: string): FeedItem {
  const u = username ?? pick(USERNAMES);
  const f = flagOvr ?? pick(FLAGS);
  let action = "", rightLabel = "", rightSub = "", amount = 0;

  switch (type) {
    case "deposit": {
      amount = randAmt(200, 12_000);
      action = "deposited";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "withdrawal": {
      amount = randAmt(100, 6_000);
      action = "withdrew";
      rightLabel = `-${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "investment": {
      const plan = pick(PLANS);
      amount = randAmt(500, 20_000);
      action = `invested in ${plan}`;
      rightLabel = fmtAmt(amount);
      rightSub = "USDT";
      break;
    }
    case "earning": {
      amount = randAmt(8, 900);
      action = "earned ROI profit";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "profit_claimed": {
      amount = randAmt(20, 1_200);
      action = "claimed profit";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "reinvest": {
      amount = randAmt(30, 800);
      action = "reinvested earnings";
      rightLabel = fmtAmt(amount);
      rightSub = "USDT";
      break;
    }
    case "referral": {
      amount = randAmt(5, 300);
      action = "earned referral bonus";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "staking": {
      amount = randAmt(100, 5_000);
      const asset = pick(STAKE_ASSETS);
      action = `staked ${asset}`;
      rightLabel = fmtAmt(amount);
      rightSub = "USDT";
      break;
    }
    case "auto_compound": {
      amount = randAmt(15, 500);
      action = "auto-compounded";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "invest_complete": {
      const plan = pick(PLANS);
      amount = randAmt(500, 15_000);
      action = `completed ${plan}`;
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "profit";
      break;
    }
    case "vip_upgrade": {
      const tier = pick(VIP_TIERS);
      amount = 0;
      action = `upgraded to ${tier}`;
      rightLabel = tier.split(" ")[0];
      rightSub = "VIP";
      break;
    }
  }

  return { id, type, username: u, flag: f, action, rightLabel, rightSub, amount, ts };
}

function genItem(tsOverride?: number, idOverride?: string): FeedItem {
  const id = idOverride ?? `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return buildItem(weightedType(), tsOverride ?? Date.now(), id);
}

function genUnique(recentNames: string[], recentAmts: number[]): FeedItem {
  let item: FeedItem;
  let tries = 0;
  do {
    item = genItem();
    tries++;
  } while (
    tries < 10 &&
    (recentNames.includes(item.username) ||
     recentAmts.some(a => a > 0 && item.amount > 0 && Math.abs(a - item.amount) < 15))
  );
  return item;
}

function buildRealItem(d: any): FeedItem {
  const type = (d.type ?? "earning") as ActivityType;
  return buildItem(type, new Date(d.createdAt).getTime(), d.id, d.username, pick(FLAGS));
}

// ─── Type visual config ───────────────────────────────────────────────────────
type CfgEntry = {
  icon: React.ElementType;
  iconBg: string; iconColor: string;
  amountColor: string;
};

const TYPE_CFG: Record<ActivityType, CfgEntry> = {
  deposit:        { icon: ArrowDownLeft, iconBg: "bg-emerald-100", iconColor: "text-emerald-600",amountColor: "text-emerald-600" },
  withdrawal:     { icon: ArrowUpRight,  iconBg: "bg-red-100",     iconColor: "text-red-500",    amountColor: "text-red-500"    },
  investment:     { icon: TrendingUp,    iconBg: "bg-blue-100",    iconColor: "text-blue-600",   amountColor: "text-blue-600"   },
  earning:        { icon: Zap,           iconBg: "bg-amber-100",   iconColor: "text-amber-500",  amountColor: "text-emerald-600"},
  profit_claimed: { icon: CheckCircle2,  iconBg: "bg-emerald-100", iconColor: "text-emerald-500",amountColor: "text-emerald-600"},
  reinvest:       { icon: RefreshCcw,    iconBg: "bg-purple-100",  iconColor: "text-purple-600", amountColor: "text-purple-600" },
  referral:       { icon: Users,         iconBg: "bg-yellow-100",  iconColor: "text-yellow-600", amountColor: "text-yellow-600" },
  staking:        { icon: Award,         iconBg: "bg-cyan-100",    iconColor: "text-cyan-600",   amountColor: "text-cyan-600"   },
  auto_compound:  { icon: RefreshCcw,    iconBg: "bg-violet-100",  iconColor: "text-violet-600", amountColor: "text-violet-600" },
  invest_complete:{ icon: Trophy,        iconBg: "bg-blue-100",    iconColor: "text-blue-600",   amountColor: "text-emerald-600"},
  vip_upgrade:    { icon: Star,          iconBg: "bg-yellow-100",  iconColor: "text-yellow-500", amountColor: "text-yellow-600" },
};

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────
function ShimmerRow() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-[9px] border-b border-border/40">
      <div className="w-7 h-7 rounded-full bg-slate-200 animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 bg-slate-200 rounded-full animate-pulse w-3/4" />
        <div className="h-2 bg-slate-100 rounded-full animate-pulse w-1/3" />
      </div>
      <div className="text-right space-y-1.5 shrink-0">
        <div className="h-2.5 w-14 bg-slate-200 rounded-full animate-pulse" />
        <div className="h-2 w-8 bg-slate-100 rounded-full animate-pulse ml-auto" />
      </div>
    </div>
  );
}

// ─── Single activity row (memoized) ──────────────────────────────────────────
const ActivityRow = memo(function ActivityRow({
  item, isNew, idx, tick,
}: { item: FeedItem; isNew: boolean; idx: number; tick: number }) {
  const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.earning;
  const Icon = cfg.icon;
  const faded = idx >= 12;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-[9px] border-b border-border/30 transition-all duration-300",
        isNew   ? "activity-slide-in bg-emerald-50/70" : "",
        idx === 0 && !isNew ? "bg-slate-50/60" : "",
        faded   ? "opacity-60" : "",
      )}
    >
      {/* Icon */}
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        cfg.iconBg,
      )}>
        <Icon size={12} className={cfg.iconColor} strokeWidth={2.2} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] leading-snug truncate">
          <span className="font-bold text-foreground">@{item.username}</span>
          {" "}
          <span className="text-muted-foreground font-medium">{item.action}</span>
          {" "}<span className="text-[10px] leading-none">{item.flag}</span>
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-[2px] tabular-nums">
          {timeAgo(item.ts)}
          {item.isReal && (
            <span className="ml-1.5 text-[8.5px] text-emerald-500 font-bold uppercase tracking-wider">✓ live</span>
          )}
        </p>
      </div>

      {/* Right amount */}
      <div className="text-right shrink-0 min-w-[52px]">
        <p className={cn("text-[12px] font-bold tabular-nums leading-tight", cfg.amountColor)}>
          {item.rightLabel}
        </p>
        <p className="text-[9px] text-muted-foreground/50 leading-tight">{item.rightSub}</p>
      </div>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
const MAX_ITEMS  = 20;
const SHOW_ITEMS = 15;

export function LiveActivityFeed() {
  const [items,   setItems]   = useState<FeedItem[]>(() => cache.items);
  const [newId,   setNewId]   = useState<string | null>(null);
  const [volume,  setVolume]  = useState(() => cache.volume  || initVolume());
  const [online,  setOnline]  = useState(() => cache.online  || initOnline());
  const [totalTx, setTotalTx] = useState(() => cache.totalTx || 1_247);
  const [loading, setLoading] = useState(!cache.initialized);
  const [tick,    setTick]    = useState(0);

  const recentNames = useRef<string[]>([]);
  const recentAmts  = useRef<number[]>([]);
  const scheduleRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Seed on first mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (cache.initialized) { setLoading(false); return; }

    const seed = Array.from({ length: 12 }, (_, i) =>
      genItem(Date.now() - i * (18_000 + Math.random() * 35_000), `seed-${i}`)
    );
    cache.items       = seed;
    cache.totalTx     = 1_247 + seed.length;
    cache.initialized = true;

    setItems(seed);
    setTotalTx(cache.totalTx);
    const t = setTimeout(() => setLoading(false), 380);
    return () => clearTimeout(t);
  }, []);

  // ── Fetch real DB activities ───────────────────────────────────────────────
  useEffect(() => {
    const fetchReal = async () => {
      try {
        const res = await fetch("/api/dashboard/live-activity", { credentials: "include" });
        if (!res.ok) return;
        const data: any[] = await res.json();
        if (!data.length) return;
        const existingIds = new Set(cache.items.map(i => i.id));
        const fresh = data
          .filter(d => !existingIds.has(d.id))
          .map(d => ({ ...buildRealItem(d), isReal: true }));
        if (!fresh.length) return;
        cache.items = [...fresh, ...cache.items].sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
        setItems([...cache.items]);
      } catch { /* silent */ }
    };
    fetchReal();
    const id = setInterval(fetchReal, 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Add new generated activity ─────────────────────────────────────────────
  const addItem = useCallback((item: FeedItem) => {
    cache.items   = [item, ...cache.items].slice(0, MAX_ITEMS);
    cache.volume += item.amount;
    cache.totalTx++;
    setItems([...cache.items]);
    setVolume(cache.volume);
    setTotalTx(cache.totalTx);
    setNewId(item.id);
    setTimeout(() => setNewId(null), 650);
  }, []);

  useEffect(() => {
    const schedule = () => {
      const delay = 2_200 + Math.random() * 2_800;
      scheduleRef.current = setTimeout(() => {
        const item = genUnique(recentNames.current, recentAmts.current);
        recentNames.current = [item.username, ...recentNames.current].slice(0, 4);
        recentAmts.current  = [item.amount,   ...recentAmts.current ].slice(0, 3);
        addItem(item);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(scheduleRef.current);
  }, [addItem]);

  // ── Online fluctuation ─────────────────────────────────────────────────────
  useEffect(() => {
    const fluctuate = () => {
      const delta = Math.floor((Math.random() - 0.42) * 28);
      cache.online = Math.max(1_100, Math.min(3_200, cache.online + delta));
      setOnline(cache.online);
    };
    const id = setInterval(fluctuate, 9_000 + Math.random() * 5_000);
    return () => clearInterval(id);
  }, []);

  // ── TimeAgo refresh ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes liveGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
          50%      { box-shadow: 0 0 0 4px rgba(34,197,94,0.25); }
        }
        .activity-slide-in { animation: slideDown 0.32s cubic-bezier(.22,1,.36,1) forwards; }
        .live-dot-glow     { animation: liveGlow 2.2s ease-in-out infinite; }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-border bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Row 1 – title + LIVE */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex items-center justify-center w-5 h-5">
              <span className="live-dot-glow absolute w-4 h-4 rounded-full bg-emerald-500/20" />
              <span className="animate-ping absolute w-3 h-3 rounded-full bg-emerald-400 opacity-50" />
              <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10.5px] font-black text-emerald-600 tracking-[0.18em] uppercase">Live</span>
            <div className="w-px h-3 bg-border/70" />
            <p className="text-[13px] font-bold text-foreground">Platform Activity</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100/80 border border-border/50 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
              {totalTx.toLocaleString()} txns
            </span>
          </div>
        </div>

        {/* Row 2 – stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-border/60 rounded-lg px-2 py-1 shadow-sm">
            <TrendingUp size={9} className="text-emerald-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground">Today's vol</span>
            <span className="text-[10.5px] font-bold text-foreground tabular-nums">
              {fmtVolume(volume)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-border/60 rounded-lg px-2 py-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground">Online</span>
            <span className="text-[10.5px] font-bold text-foreground tabular-nums">
              {fmtOnline(online)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Feed ──────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ShimmerRow key={i} />)
          : items.slice(0, SHOW_ITEMS).map((item, idx) => (
              <ActivityRow
                key={item.id}
                item={item}
                isNew={item.id === newId}
                idx={idx}
                tick={tick}
              />
            ))
        }
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50/80 border-t border-border/40">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[10px] text-muted-foreground">Updating live · Global real-time activity</span>
      </div>
    </div>
  );
}
