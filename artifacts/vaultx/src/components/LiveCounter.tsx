import { useState, useEffect, useRef } from "react";
import { formatUSDT } from "@/lib/format";

/**
 * Accurate live earnings counter that accounts for time elapsed since the last
 * server-credited payout.  This prevents the counter from "resetting" on
 * navigation because we always reconstruct the correct accumulated value from
 * server data (pendingEarnings + accrued-since-lastEarningAt).
 */
export function LiveCounter({
  pendingEarnings,
  dailyRate,
  principal,
  lastEarningAt,
  startDate,
  decimals = 6,
}: {
  pendingEarnings: number;
  dailyRate: number;
  principal: number;
  lastEarningAt: string | null;
  startDate: string;
  decimals?: number;
}) {
  const stateRef = useRef({ pendingEarnings, dailyRate, principal, lastEarningAt, startDate });
  stateRef.current = { pendingEarnings, dailyRate, principal, lastEarningAt, startDate };

  const computeBase = () => {
    const { pendingEarnings: pe, dailyRate: dr, principal: p, lastEarningAt: lea, startDate: sd } =
      stateRef.current;
    const perMs = p > 0 && dr > 0 ? (p * dr) / 86_400_000 : 0;
    if (perMs <= 0) return pe;
    const ref = lea ? new Date(lea) : new Date(sd);
    const elapsed = Math.max(0, Date.now() - ref.getTime());
    return pe + perMs * elapsed;
  };

  const [value, setValue] = useState(computeBase);

  // When server data refreshes (after a cron credit), re-anchor the counter
  const prevKey = useRef(`${pendingEarnings}|${lastEarningAt}`);
  useEffect(() => {
    const key = `${pendingEarnings}|${lastEarningAt}`;
    if (key !== prevKey.current) {
      prevKey.current = key;
      setValue(computeBase());
    }
  });

  // Single interval per mount — reads latest values via ref to avoid stale closures
  useEffect(() => {
    const id = setInterval(() => {
      const { dailyRate: dr, principal: p } = stateRef.current;
      const perMs = p > 0 && dr > 0 ? (p * dr) / 86_400_000 : 0;
      if (perMs > 0) setValue((v) => v + perMs * 1_000);
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="tabular-nums font-bold text-emerald-600">
      {formatUSDT(value, decimals)}
    </span>
  );
}

/**
 * Countdown timer to the next expected payout.
 */
export function PayoutCountdown({ nextPayoutAt }: { nextPayoutAt: string }) {
  const getLeft = () => Math.max(0, new Date(nextPayoutAt).getTime() - Date.now());
  const [left, setLeft] = useState(getLeft);

  useEffect(() => {
    setLeft(getLeft());
    const id = setInterval(() => setLeft(getLeft()), 1_000);
    return () => clearInterval(id);
  }, [nextPayoutAt]);

  if (left <= 0) {
    return <span className="text-emerald-500 font-semibold text-xs">Processing soon…</span>;
  }

  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1_000);

  return (
    <span className="tabular-nums font-mono text-xs font-semibold text-foreground">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
