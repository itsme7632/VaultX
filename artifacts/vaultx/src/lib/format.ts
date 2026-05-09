export function formatUSDT(v: number, decimals = 2): string {
  if (v === 0) return "0.00 USDT";
  if (Math.abs(v) < 0.01) return v.toFixed(6) + " USDT";
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " USDT";
}

export function formatUSDTCompact(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M USDT";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K USDT";
  return formatUSDT(v);
}

export function formatPct(v: number, decimals = 2): string {
  return (v * 100).toFixed(decimals) + "%";
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
