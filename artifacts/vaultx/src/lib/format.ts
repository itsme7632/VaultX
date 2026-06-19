function safeV(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return isFinite(n) ? n : fallback;
}

export function formatUSDT(v: unknown, decimals = 2): string {
  const n = safeV(v);
  if (n === 0) return "0.00 USDT";
  if (Math.abs(n) < 0.01) return n.toFixed(6) + " USDT";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " USDT";
}

export function formatUSDTCompact(v: unknown): string {
  const n = safeV(v);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M USDT";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K USDT";
  return formatUSDT(n);
}

export function formatPct(v: unknown, decimals = 2): string {
  const n = safeV(v);
  return (n * 100).toFixed(decimals) + "%";
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
