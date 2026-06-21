export interface ReceiptTx {
  txId?: string | null;
  id: number;
  type: string;
  amount: number;
  fee?: number;
  network?: string | null;
  address?: string | null;
  txHash?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReceiptSettings {
  platformName: string;
  platformLogoUrl?: string;
  platformUrl?: string;
}

const INCOMING_TYPES = ["deposit", "earning", "referral", "reinvest", "admin_adjustment"];

function fmtAmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
}

function fmtDt(s: string): string {
  return new Date(s).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ─── Canvas receipt PNG ────────────────────────────────────────────────────────
export async function generateReceiptImageUrl(tx: ReceiptTx, settings: ReceiptSettings): Promise<string> {
  const W = 560;
  const SCALE = 2;
  const PAD = 40;
  const ROW_H = 46;

  const isIncoming = INCOMING_TYPES.includes(tx.type);
  const isCompleted = tx.status === "completed";
  const isFailed = tx.status === "failed";
  const statusColor = isCompleted ? "#22c55e" : isFailed ? "#ef4444" : "#f59e0b";
  const statusLabel = isCompleted ? "COMPLETED" : isFailed ? "REJECTED" : "PENDING";
  const amountColor = isIncoming ? "#4ade80" : "#f87171";
  const platformName = settings.platformName || "Wexora";

  const rows: [string, string, boolean?][] = [
    ["Wexora TxID", tx.txId ?? `#${tx.id}`, true],
    ["Type", tx.type.replace(/_/g, " ")],
    ["Status", statusLabel],
    ["Submitted", fmtDt(tx.createdAt)],
    ...(tx.updatedAt && tx.updatedAt !== tx.createdAt && tx.status !== "pending"
      ? [["Processed", fmtDt(tx.updatedAt)] as [string, string]]
      : []),
    ...(tx.network ? [["Network", tx.network] as [string, string]] : []),
    ...(tx.fee && tx.fee > 0 ? [["Fee", fmtAmt(tx.fee)] as [string, string]] : []),
    ...(tx.address
      ? [["Address", tx.address.length > 24 ? tx.address.slice(0, 12) + "…" + tx.address.slice(-8) : tx.address] as [string, string]]
      : []),
    ...(tx.txHash
      ? [["TX Hash", tx.txHash.slice(0, 20) + "…"] as [string, string]]
      : []),
  ];

  const HEADER_H = 248;
  const FOOTER_H = 68;
  const H = HEADER_H + rows.length * ROW_H + 28 + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.6, "#0d1b30");
  bg.addColorStop(1, "#0a1525");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Top accent bar ──────────────────────────────────────────────────────────
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, "#1d4ed8");
  bar.addColorStop(0.5, "#2563eb");
  bar.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, 4);

  // ── Header tint ─────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(37,99,235,0.07)";
  ctx.fillRect(0, 4, W, HEADER_H - 4);

  // ── Logo circle ─────────────────────────────────────────────────────────────
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.arc(W / 2, 52, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 22px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("V", W / 2, 52);

  // ── Platform name ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#94a3b8";
  ctx.font = `700 12px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(platformName.toUpperCase(), W / 2, 96);

  // ── Status ring + symbol ─────────────────────────────────────────────────────
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, 132, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = statusColor + "20";
  ctx.beginPath();
  ctx.arc(W / 2, 132, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = statusColor;
  ctx.font = `bold 18px Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(isCompleted ? "✓" : isFailed ? "✗" : "●", W / 2, 132);

  // ── Amount ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = amountColor;
  ctx.font = `900 38px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${isIncoming ? "+" : "−"}${fmtAmt(tx.amount)}`, W / 2, 192);

  // ── Type label ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#475569";
  ctx.font = `600 11px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(tx.type.replace(/_/g, " ").toUpperCase(), W / 2, 214);

  // ── Section divider ──────────────────────────────────────────────────────────
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, HEADER_H - 16);
  ctx.lineTo(W - PAD, HEADER_H - 16);
  ctx.stroke();

  // ── Detail rows ──────────────────────────────────────────────────────────────
  let y = HEADER_H;
  rows.forEach(([label, value, highlight], rowIdx) => {
    if (rowIdx % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.018)";
      ctx.fillRect(PAD, y, W - PAD * 2, ROW_H);
    }

    ctx.fillStyle = "#64748b";
    ctx.font = `400 12px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, PAD + 6, y + ROW_H / 2);

    ctx.fillStyle = highlight ? "#60a5fa" : label === "Status"
      ? (isCompleted ? "#4ade80" : isFailed ? "#f87171" : "#fbbf24")
      : "#e2e8f0";
    ctx.font = `600 12px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(String(value), W - PAD - 6, y + ROW_H / 2);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD, y + ROW_H);
    ctx.lineTo(W - PAD, y + ROW_H);
    ctx.stroke();

    y += ROW_H;
  });

  y += 28;

  // ── Dashed separator ─────────────────────────────────────────────────────────
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Footer ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = "#334155";
  ctx.font = `400 10px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `Generated by ${platformName} · ${new Date().toLocaleString("en-US", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    })}`,
    W / 2, y + 24
  );

  ctx.fillStyle = "#1e3a5f";
  ctx.font = `400 9px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText("This is an official transaction receipt.", W / 2, y + 42);

  return canvas.toDataURL("image/png");
}

// ─── Download PNG to device ───────────────────────────────────────────────────
export async function downloadReceiptImage(tx: ReceiptTx, settings: ReceiptSettings): Promise<void> {
  const dataUrl = await generateReceiptImageUrl(tx, settings);
  const fileName = `Wexora-Receipt-${tx.txId ?? tx.id}.png`;

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  } catch {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// ─── Native share with image file, fallback to text ──────────────────────────
export async function shareReceiptImage(tx: ReceiptTx, settings: ReceiptSettings): Promise<boolean> {
  const platformName = settings.platformName || "Wexora";

  // Build text summary (used as fallback)
  const textLines = [
    `${platformName} Transaction Receipt`,
    `TxID: ${tx.txId ?? tx.id}`,
    `Type: ${tx.type.replace(/_/g, " ")}`,
    `Amount: ${INCOMING_TYPES.includes(tx.type) ? "+" : "-"}${fmtAmt(tx.amount)}`,
    `Status: ${tx.status}`,
    `Date: ${fmtDt(tx.createdAt)}`,
    tx.network ? `Network: ${tx.network}` : "",
  ].filter(Boolean).join("\n");

  // Try sharing as image file first (shows full share sheet on mobile)
  try {
    const dataUrl = await generateReceiptImageUrl(tx, settings);
    const fetchRes = await fetch(dataUrl);
    const blob = await fetchRes.blob();
    const file = new File([blob], `Wexora-Receipt-${tx.txId ?? tx.id}.png`, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `${platformName} Receipt` });
      return true;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return true;
  }

  // Fallback: share text via native API (opens share sheet on mobile)
  if (navigator.share) {
    try {
      await navigator.share({ title: `${platformName} Receipt`, text: textLines });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return true;
    }
  }

  return false;
}

// ─── PDF export ───────────────────────────────────────────────────────────────
export async function downloadReceiptPDF(tx: ReceiptTx, settings: ReceiptSettings): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const isIncoming = INCOMING_TYPES.includes(tx.type);
  const isCompleted = tx.status === "completed";
  const isFailed = tx.status === "failed";
  const platformName = settings.platformName || "Wexora";
  const statusLabel = isCompleted ? "COMPLETED" : isFailed ? "REJECTED" : "PENDING";
  const statusClr: [number, number, number] = isCompleted ? [34, 197, 94] : isFailed ? [239, 68, 68] : [245, 158, 11];
  const amountClr: [number, number, number] = isIncoming ? [74, 222, 128] : [248, 113, 113];

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const W = 148;

  // Background
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 210, "F");

  // Top accent bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 1.5, "F");

  // Header tint
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 1.5, W, 68, "F");

  // Logo circle
  doc.setFillColor(37, 99, 235);
  doc.circle(W / 2, 18, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("V", W / 2, 20.8, { align: "center" });

  // Platform name
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(platformName.toUpperCase(), W / 2, 30, { align: "center" });

  // Status label
  doc.setTextColor(...statusClr);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(statusLabel, W / 2, 40, { align: "center" });

  // Amount
  doc.setTextColor(...amountClr);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${isIncoming ? "+" : "-"}${fmtAmt(tx.amount)}`, W / 2, 53, { align: "center" });

  // Type
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(tx.type.replace(/_/g, " ").toUpperCase(), W / 2, 61, { align: "center" });

  // Section divider
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.3);
  doc.line(12, 68, W - 12, 68);

  const rows: [string, string][] = [
    ["Wexora TxID", tx.txId ?? `#${tx.id}`],
    ["Type", tx.type.replace(/_/g, " ")],
    ["Status", statusLabel],
    ["Submitted", fmtDt(tx.createdAt)],
    ...(tx.updatedAt && tx.updatedAt !== tx.createdAt && tx.status !== "pending"
      ? [["Processed", fmtDt(tx.updatedAt)] as [string, string]]
      : []),
    ...(tx.network ? [["Network", tx.network] as [string, string]] : []),
    ...(tx.fee && tx.fee > 0 ? [["Fee", fmtAmt(tx.fee)] as [string, string]] : []),
    ...(tx.address
      ? [["Address", tx.address.length > 34 ? tx.address.slice(0, 16) + "…" + tx.address.slice(-10) : tx.address] as [string, string]]
      : []),
    ...(tx.txHash
      ? [["TX Hash", tx.txHash.slice(0, 22) + "…"] as [string, string]]
      : []),
  ];

  let y = 78;
  for (const [label, value] of rows) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(label, 14, y);

    doc.setTextColor(label === "Wexora TxID" ? 96 : 226, label === "Wexora TxID" ? 165 : 232, label === "Wexora TxID" ? 250 : 240);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(value, W - 14, y, { align: "right" });

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.2);
    doc.line(12, y + 3, W - 12, y + 3);
    y += 11;
  }

  // Dashed footer separator
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(12, y + 4, W - 12, y + 4);
  doc.setLineDashPattern([], 0);

  // Footer text
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated by ${platformName} · ${new Date().toLocaleString("en-US", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    })}`,
    W / 2, y + 11, { align: "center" }
  );
  doc.text("This is an official transaction receipt.", W / 2, y + 17, { align: "center" });

  doc.save(`Wexora-Receipt-${tx.txId ?? tx.id}.pdf`);
}
