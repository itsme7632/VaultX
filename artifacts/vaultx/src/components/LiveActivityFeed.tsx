import { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, Zap, Users, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityType =
  | "deposit" | "withdrawal" | "investment"
  | "earning" | "profit_claimed" | "referral" | "vip_upgrade";

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

interface FeedConfig {
  mode: "demo" | "real";
  enableDeposits: boolean;
  enableInvestments: boolean;
  enableWithdrawals: boolean;
  enableEarnings: boolean;
  enableReferrals: boolean;
  minAmount: number;
  maxAmount: number;
  frequencySeconds: number;
  usernameStyle: "partial" | "full" | "anonymous";
}

const DEFAULT_CONFIG: FeedConfig = {
  mode: "demo",
  enableDeposits: true,
  enableInvestments: true,
  enableWithdrawals: true,
  enableEarnings: true,
  enableReferrals: true,
  minAmount: 50,
  maxAmount: 5000,
  frequencySeconds: 14,
  usernameStyle: "partial",
};

const cache = {
  items:       [] as FeedItem[],
  volume:      0,
  online:      0,
  totalTx:     0,
  initialized: false,
  config:      null as FeedConfig | null,
};

const USERNAMES_PARTIAL = [
  "mike_r",   "alex***",  "john",     "emma_k",   "sarah***",
  "david_m",  "chris",    "anna_t",   "james",    "lisa_w",
  "tom***",   "kate_p",   "ryan",     "nina_m",   "mark_j",
  "amy***",   "paul",     "jessica",  "dan_k",    "helen",
  "rob***",   "carol",    "steve_m",  "linda",    "kevin",
  "mary***",  "george",   "susan",    "peter_r",  "karen",
  "sam",      "tina***",  "joe_k",    "grace",    "luke_t",
  "mia",      "ben_r",    "claire",   "matt",     "laura***",
];
const USERNAMES_FULL = [
  "michael_r", "alexander", "johnny_k", "emma_kate", "sarah_j",
  "david_m", "christopher", "anna_t", "james_w", "lisa_wade",
  "tommy_b", "katelyn_p", "ryan_t", "nina_m", "markus_j",
  "amy_c", "paulin", "jessica_m", "danny_k", "helen_r",
];
const USERNAMES_ANON = [
  "User****1", "User****2", "User****3", "User****4", "User****5",
  "User****6", "User****7", "User****8", "User****9", "User****0",
];

const FLAGS_COMMON = ["🇺🇸","🇺🇸","🇬🇧","🇬🇧","🇦🇪","🇮🇳","🇳🇬","🇨🇦","🇦🇺","🇩🇪"];
const FLAGS_OTHER  = ["🇫🇷","🇸🇦","🇰🇪","🇵🇰","🇸🇬","🇲🇾","🇿🇦","🇧🇷","🇪🇸","🇯🇵","🇹🇷","🇵🇭","🇪🇬"];

const PLANS = ["Starter Plan", "Growth Plan", "Elite Plan", "Premium Plan"];
const VIP_TIERS = ["Silver VIP", "Gold VIP", "Platinum VIP"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function pickFlag(): string {
  return Math.random() < 0.70 ? pick(FLAGS_COMMON) : pick(FLAGS_OTHER);
}

function randAmt(min: number, max: number): number {
  const raw = min + Math.pow(Math.random(), 1.8) * (max - min);
  if (raw >= 5_000) return Math.round(raw / 500) * 500;
  if (raw >= 1_000) return Math.round(raw / 50)  * 50;
  if (raw >= 200)   return Math.round(raw / 10)  * 10;
  if (raw >= 50)    return Math.round(raw / 5)   * 5;
  return Math.round(raw);
}

function fmtAmt(n: number): string {
  if (n >= 1_000) return n.toLocaleString();
  if (n < 10)     return n.toFixed(2);
  return String(n);
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtOnline(n: number): string {
  return n.toLocaleString();
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 8)    return "just now";
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return m === 1 ? "1m ago" : `${m}m ago`;
  }
  const h = Math.floor(s / 3600);
  return h === 1 ? "1h ago" : `${h}h ago`;
}

function initVolume() {
  const v = 120_000 + Math.random() * 530_000;
  cache.volume = v;
  return v;
}

function initOnline() {
  const o = 120 + Math.floor(Math.random() * 780);
  cache.online = o;
  return o;
}

function getEnabledTypes(cfg: FeedConfig): ActivityType[] {
  const types: ActivityType[] = [];
  if (cfg.enableDeposits)    types.push("deposit");
  if (cfg.enableInvestments) types.push("investment");
  if (cfg.enableEarnings)    types.push("earning", "profit_claimed");
  if (cfg.enableWithdrawals) types.push("withdrawal");
  if (cfg.enableReferrals)   types.push("referral");
  types.push("vip_upgrade");
  return types.length > 0 ? types : ["deposit", "earning"];
}

const WEIGHTED_TYPES_DEFAULT: Array<{ type: ActivityType; w: number }> = [
  { type: "deposit",        w: 6 },
  { type: "investment",     w: 5 },
  { type: "earning",        w: 5 },
  { type: "profit_claimed", w: 3 },
  { type: "withdrawal",     w: 2 },
  { type: "referral",       w: 1 },
  { type: "vip_upgrade",    w: 0.3 },
];
const W_TOTAL = WEIGHTED_TYPES_DEFAULT.reduce((s, t) => s + t.w, 0);

function weightedType(enabledTypes: ActivityType[]): ActivityType {
  const filtered = WEIGHTED_TYPES_DEFAULT.filter(t => enabledTypes.includes(t.type));
  if (!filtered.length) return "earning";
  const total = filtered.reduce((s, t) => s + t.w, 0);
  let r = Math.random() * total;
  for (const t of filtered) {
    r -= t.w;
    if (r <= 0) return t.type;
  }
  return filtered[filtered.length - 1].type;
}

function getUsernames(style: FeedConfig["usernameStyle"]) {
  if (style === "full")      return USERNAMES_FULL;
  if (style === "anonymous") return USERNAMES_ANON;
  return USERNAMES_PARTIAL;
}

function buildItem(
  type: ActivityType, ts: number, id: string,
  cfg: FeedConfig,
  username?: string, flagOvr?: string,
): FeedItem {
  const u = username ?? pick(getUsernames(cfg.usernameStyle));
  const f = flagOvr  ?? pickFlag();
  const amtMin = cfg.minAmount;
  const amtMax = cfg.maxAmount;

  let action = "", rightLabel = "", rightSub = "", amount = 0;

  switch (type) {
    case "deposit": {
      amount = randAmt(amtMin, Math.min(amtMax, 3_500));
      action = "deposited";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "withdrawal": {
      amount = randAmt(amtMin, Math.min(amtMax, 1_800));
      action = "withdrew";
      rightLabel = `-${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "investment": {
      const plan = pick(PLANS);
      amount = randAmt(Math.max(amtMin, 100), amtMax);
      action = `invested in ${plan}`;
      rightLabel = fmtAmt(amount);
      rightSub = "USDT";
      break;
    }
    case "earning": {
      amount = randAmt(5, Math.min(amtMax * 0.05, 250));
      action = "earned profit";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "profit_claimed": {
      amount = randAmt(10, Math.min(amtMax * 0.08, 400));
      action = "claimed profit";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
      break;
    }
    case "referral": {
      amount = randAmt(5, Math.min(amtMax * 0.025, 120));
      action = "earned referral bonus";
      rightLabel = `+${fmtAmt(amount)}`;
      rightSub = "USDT";
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

function genItem(cfg: FeedConfig, tsOverride?: number, idOverride?: string): FeedItem {
  const id = idOverride ?? `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const types = getEnabledTypes(cfg);
  return buildItem(weightedType(types), tsOverride ?? Date.now(), id, cfg);
}

function genUnique(cfg: FeedConfig, recentNames: string[], recentAmts: number[]): FeedItem {
  let item = genItem(cfg);
  let tries = 0;
  while (
    tries < 8 &&
    (recentNames.slice(0, 3).includes(item.username) ||
     recentAmts.some(a => a > 0 && item.amount > 0 && Math.abs(a - item.amount) < 8))
  ) {
    item = genItem(cfg);
    tries++;
  }
  return item;
}

function buildRealItem(d: any, cfg: FeedConfig): FeedItem {
  const type = (d.type ?? "earning") as ActivityType;
  return buildItem(type, new Date(d.createdAt).getTime(), d.id, cfg, d.username, pickFlag());
}

type CfgEntry = {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  amountColor: string;
};

const TYPE_CFG: Record<ActivityType, CfgEntry> = {
  deposit:        { icon: ArrowDownLeft, iconBg: "bg-green-500/10",       iconColor: "text-green-500",  amountColor: "text-green-500"  },
  withdrawal:     { icon: ArrowUpRight,  iconBg: "bg-red-500/10",         iconColor: "text-red-500",    amountColor: "text-red-500"    },
  investment:     { icon: TrendingUp,    iconBg: "bg-blue-500/10",        iconColor: "text-blue-500",   amountColor: "text-blue-500"   },
  earning:        { icon: Zap,           iconBg: "bg-amber-500/10",       iconColor: "text-amber-500",  amountColor: "text-green-500"  },
  profit_claimed: { icon: Zap,           iconBg: "bg-green-500/10",       iconColor: "text-green-500",  amountColor: "text-green-500"  },
  referral:       { icon: Users,         iconBg: "bg-purple-500/10",      iconColor: "text-purple-500", amountColor: "text-purple-500" },
  vip_upgrade:    { icon: Star,          iconBg: "bg-yellow-500/10",      iconColor: "text-yellow-500", amountColor: "text-yellow-500" },
};

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-[10px] border-b border-border">
      <div className="w-7 h-7 rounded-full bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 bg-muted rounded-full animate-pulse w-2/3" />
        <div className="h-1.5 bg-muted rounded-full animate-pulse w-1/4" />
      </div>
      <div className="text-right space-y-2 shrink-0">
        <div className="h-2.5 w-12 bg-muted rounded-full animate-pulse" />
        <div className="h-1.5 w-8 bg-muted rounded-full animate-pulse ml-auto" />
      </div>
    </div>
  );
}

const ActivityRow = memo(function ActivityRow({
  item, isNew, idx,
}: { item: FeedItem; isNew: boolean; idx: number; tick: number }) {
  const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.earning;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-[10px] border-b border-border transition-colors duration-500",
        isNew ? "feed-in bg-primary/5" : "bg-card",
        idx >= 10 ? "opacity-50" : idx >= 7 ? "opacity-70" : "",
      )}
    >
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        cfg.iconBg,
      )}>
        <Icon size={12} className={cfg.iconColor} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] leading-snug">
          <span className="font-semibold text-foreground">@{item.username}</span>
          {" "}
          <span className="text-muted-foreground">{item.action}</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-[2px] tabular-nums">
          {item.flag} · {timeAgo(item.ts)}
          {item.isReal && (
            <span className="ml-1.5 text-[9px] text-green-500 font-medium">· verified</span>
          )}
        </p>
      </div>

      <div className="text-right shrink-0 min-w-[50px]">
        <p className={cn("text-[12.5px] font-semibold tabular-nums leading-tight", cfg.amountColor)}>
          {item.rightLabel}
        </p>
        <p className="text-[9.5px] text-muted-foreground leading-tight">{item.rightSub}</p>
      </div>
    </div>
  );
});

const MAX_ITEMS  = 20;
const SHOW_ITEMS = 12;

export function LiveActivityFeed() {
  const [items,   setItems]   = useState<FeedItem[]>(() => cache.items);
  const [newId,   setNewId]   = useState<string | null>(null);
  const [volume,  setVolume]  = useState(() => cache.volume  || initVolume());
  const [online,  setOnline]  = useState(() => cache.online  || initOnline());
  const [totalTx, setTotalTx] = useState(() => cache.totalTx || 847);
  const [loading, setLoading] = useState(!cache.initialized);
  const [tick,    setTick]    = useState(0);
  const [config,  setConfig]  = useState<FeedConfig>(() => cache.config ?? DEFAULT_CONFIG);

  const recentNames = useRef<string[]>([]);
  const recentAmts  = useRef<number[]>([]);
  const scheduleRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/settings/public", { credentials: "include" });
        if (!res.ok) return;
        const s: Record<string, string> = await res.json();
        const cfg: FeedConfig = {
          mode: (s.activity_feed_mode as "demo" | "real") || "demo",
          enableDeposits:    s.feed_enable_deposits    !== "false",
          enableInvestments: s.feed_enable_investments !== "false",
          enableWithdrawals: s.feed_enable_withdrawals !== "false",
          enableEarnings:    s.feed_enable_earnings    !== "false",
          enableReferrals:   s.feed_enable_referrals   !== "false",
          minAmount:         parseFloat(s.feed_min_amount ?? "50"),
          maxAmount:         parseFloat(s.feed_max_amount ?? "5000"),
          frequencySeconds:  parseFloat(s.feed_frequency_seconds ?? "14"),
          usernameStyle:     (s.feed_username_style as FeedConfig["usernameStyle"]) || "partial",
        };
        cache.config = cfg;
        setConfig(cfg);
      } catch { }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (cache.initialized) { setLoading(false); return; }

    const now = Date.now();
    let prevTs = now;
    const seed = Array.from({ length: 10 }, (_, i) => {
      if (i > 0) {
        const spread = i < 3
          ? 15_000  + Math.random() * 45_000
          : i < 6
            ? 90_000  + Math.random() * 120_000
            : 300_000 + Math.random() * 300_000;
        prevTs = prevTs - spread;
      }
      return genItem(config, prevTs, `seed-${i}`);
    });

    cache.items       = seed;
    cache.totalTx     = 847 + seed.length;
    cache.initialized = true;

    setItems(seed);
    setTotalTx(cache.totalTx);
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fetchReal = async () => {
      try {
        const res = await fetch("/api/dashboard/live-activity", { credentials: "include" });
        if (!res.ok) return;
        const data: any[] = await res.json();
        if (!data.length) return;

        if (config.mode === "real") {
          const realItems = data.map(d => ({ ...buildRealItem(d, config), isReal: true }));
          cache.items = realItems.slice(0, MAX_ITEMS);
          setItems([...cache.items]);
          return;
        }

        const existingIds = new Set(cache.items.map(i => i.id));
        const fresh = data
          .filter(d => !existingIds.has(d.id))
          .map(d => ({ ...buildRealItem(d, config), isReal: true }));
        if (!fresh.length) return;
        cache.items = [...fresh, ...cache.items].sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
        setItems([...cache.items]);
      } catch { }
    };
    fetchReal();
    const id = setInterval(fetchReal, 60_000);
    return () => clearInterval(id);
  }, [config.mode]);

  const addItem = useCallback((item: FeedItem) => {
    cache.items    = [item, ...cache.items].slice(0, MAX_ITEMS);
    cache.volume  += item.amount;
    cache.totalTx += 1;
    setItems([...cache.items]);
    setVolume(cache.volume);
    setTotalTx(cache.totalTx);
    setNewId(item.id);
    setTimeout(() => setNewId(null), 800);
  }, []);

  useEffect(() => {
    if (config.mode === "real") return;

    const freqMs = (config.frequencySeconds || 14) * 1000;

    const schedule = () => {
      const base  = freqMs * 0.6 + Math.random() * freqMs * 0.8;
      const pause = Math.random() < 0.15 ? freqMs * 0.5 + Math.random() * freqMs * 0.5 : 0;
      const delay = base + pause;

      scheduleRef.current = setTimeout(() => {
        const item = genUnique(config, recentNames.current, recentAmts.current);
        recentNames.current = [item.username, ...recentNames.current].slice(0, 5);
        recentAmts.current  = [item.amount,   ...recentAmts.current ].slice(0, 4);
        addItem(item);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(scheduleRef.current);
  }, [addItem, config]);

  useEffect(() => {
    const drift = () => {
      const delta = Math.floor((Math.random() - 0.45) * 12);
      cache.online = Math.max(120, Math.min(900, cache.online + delta));
      setOnline(cache.online);
    };
    const id = setInterval(drift, 15_000 + Math.random() * 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (config.mode === "real") return;
    const grow = () => {
      const bump = 50 + Math.random() * 300;
      cache.volume += bump;
      setVolume(cache.volume);
    };
    const id = setInterval(grow, 20_000 + Math.random() * 20_000);
    return () => clearInterval(id);
  }, [config.mode]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <style>{`
        @keyframes feedIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .feed-in { animation: feedIn 0.4s ease-out forwards; }
      `}</style>

      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex items-center justify-center w-4 h-4">
              <span className="animate-ping absolute w-3 h-3 rounded-full bg-green-400 opacity-30" />
              <span className="relative w-2 h-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[10px] font-bold text-green-500 tracking-[0.12em] uppercase">Live</span>
            <div className="w-px h-3 bg-border" />
            <p className="text-[13px] font-semibold text-foreground">Platform Activity</p>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {totalTx.toLocaleString()} transactions
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2.5 py-1">
            <TrendingUp size={9} className="text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground">Today's vol</span>
            <span className="text-[10.5px] font-semibold text-foreground tabular-nums">
              {fmtVolume(volume)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground">Online</span>
            <span className="text-[10.5px] font-semibold text-foreground tabular-nums">
              {fmtOnline(online)}
            </span>
          </div>
        </div>
      </div>

      <div>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <ShimmerRow key={i} />)
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

      <div className="flex items-center justify-center gap-1.5 px-4 py-2 bg-muted/30 border-t border-border">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span className="text-[10px] text-muted-foreground">
          {config.mode === "real" ? "Live verified activity" : "Live activity"} · Updates automatically
        </span>
      </div>
    </div>
  );
}
