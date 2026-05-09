const PREFIXES = ["TX", "VX"];

export function generateTxId(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}-${digits}`;
}
