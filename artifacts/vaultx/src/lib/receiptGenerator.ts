import QRCode from "qrcode";

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

function fmtAmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
}

function fmtDt(s: string) {
  return new Date(s).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateReceiptImageUrl(tx: ReceiptTx, settings: ReceiptSettings): Promise<string> {
  const W = 540;
  const scale = 2;
  const isIncoming = INCOMING_TYPES.includes(tx.type);
  const isCompleted = tx.status === "completed";
  const isFailed = tx.status === "failed";
  const statusColor = isCompleted ? "#22c55e" : isFailed ? "#ef4444" : "#f59e0b";

  const rows: [string, string][] = [
    ["Transaction ID", tx.txId ?? `#${tx.id}`],
    ["Type", tx.type.replace(/_/g, " ")],
    ["Status", tx.status.charAt(0).toUpperCase() + tx.status.slice(1)],
    ["Date", fmtDt(tx.createdAt)],
    ...(tx.updatedAt && tx.updatedAt !== tx.createdAt && tx.status !== "pending"
      ? [["Processed", fmtDt(tx.updatedAt)] as [string, string]]
      : []),
    ...(tx.network ? [["Network", tx.network] as [string, string]] : []),
    ...(tx.fee && tx.fee > 0 ? [["Fee", fmtAmt(tx.fee)] as [string, string]] : []),
    ...(tx.address
      ? [["Address", tx.address.length > 22 ? tx.address.slice(0, 10) + "…" + tx.address.slice(-8) : tx.address] as [string, string]]
      : []),
    ...(tx.txHash
      ? [["TX Hash", tx.txHash.slice(0, 16) + "…"] as [string, string]]
      : []),
  ];

  const HEADER_H = 260;
  const ROW_H = 42;
  const QR_SIZE = 110;
  const FOOTER_H = 60;
  const H = HEADER_H + rows.length * ROW_H + 32 + QR_SIZE + 24 + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#0d1a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(37,99,235,0.08)";
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.arc(W / 2, 52, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px -apple-system, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("V", W / 2, 52);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 16px -apple-system, Arial, sans-serif";
  ctx.fillText(settings.platformName, W / 2, 88);

  ctx.strokeStyle = statusColor + "88";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(W / 2, 140, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = statusColor;
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(isCompleted ? "✓" : isFailed ? "✗" : "~", W / 2, 140);

  ctx.fillStyle = isIncoming ? "#4ade80" : "#f87171";
  ctx.font = "bold 34px -apple-system, Arial, sans-serif";
  ctx.fillText(`${isIncoming ? "+" : "−"}${fmtAmt(tx.amount)}`, W / 2, 192);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px -apple-system, Arial, sans-serif";
  ctx.fillText(tx.type.replace(/_/g, " ").toUpperCase(), W / 2, 218);

  ctx.fillStyle = "#334155";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 240);
  ctx.lineTo(W - 40, 240);
  ctx.stroke();

  let y = HEADER_H;
  for (const [label, value] of rows) {
    ctx.fillStyle = "#64748b";
    ctx.font = "12px -apple-system, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, 40, y + ROW_H * 0.45);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 12px -apple-system, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(value, W - 40, y + ROW_H * 0.45);

    ctx.strokeStyle = "#1e2d42";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(40, y + ROW_H);
    ctx.lineTo(W - 40, y + ROW_H);
    ctx.stroke();

    y += ROW_H;
  }

  y += 24;

  try {
    const qrDataUrl = await QRCode.toDataURL(
      `VaultX|${tx.txId ?? tx.id}|${tx.amount}|${tx.status}`,
      { width: QR_SIZE * scale, margin: 1, color: { dark: "#e2e8f0", light: "#1a2744" } }
    );
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise<void>((resolve) => { qrImg.onload = () => resolve(); });

    const qrX = W / 2 - QR_SIZE / 2;
    ctx.fillStyle = "#1a2744";
    rr(ctx, qrX - 10, y - 10, QR_SIZE + 20, QR_SIZE + 20, 10);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, y, QR_SIZE, QR_SIZE);

    ctx.fillStyle = "#64748b";
    ctx.font = "10px -apple-system, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scan to verify", W / 2, y + QR_SIZE + 16);

    y += QR_SIZE + 28;
  } catch {}

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(W - 40, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#475569";
  ctx.font = "10px -apple-system, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Generated by ${settings.platformName} · ${new Date().toLocaleDateString()}`, W / 2, y + 22);

  return canvas.toDataURL("image/png");
}

export async function downloadReceiptImage(tx: ReceiptTx, settings: ReceiptSettings): Promise<void> {
  const dataUrl = await generateReceiptImageUrl(tx, settings);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `VaultX-Receipt-${tx.txId ?? tx.id}.png`;
  a.click();
}

export async function shareReceiptImage(tx: ReceiptTx, settings: ReceiptSettings): Promise<boolean> {
  const dataUrl = await generateReceiptImageUrl(tx, settings);
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `VaultX-Receipt-${tx.txId ?? tx.id}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "VaultX Receipt" });
      return true;
    }
  } catch {}
  return false;
}

export async function downloadReceiptPDF(tx: ReceiptTx, settings: ReceiptSettings): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const isIncoming = INCOMING_TYPES.includes(tx.type);
  const isCompleted = tx.status === "completed";
  const isFailed = tx.status === "failed";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const W = 148;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 210, "F");

  doc.setFillColor(37, 99, 235);
  doc.circle(W / 2, 22, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("V", W / 2, 25, { align: "center" });

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(settings.platformName, W / 2, 38, { align: "center" });

  const statusClr: [number, number, number] = isCompleted
    ? [34, 197, 94] : isFailed ? [239, 68, 68] : [245, 158, 11];
  doc.setTextColor(...statusClr);
  doc.setFontSize(14);
  doc.text(isCompleted ? "COMPLETED" : isFailed ? "REJECTED" : "PENDING", W / 2, 52, { align: "center" });

  doc.setTextColor(...(isIncoming ? [74, 222, 128] as [number,number,number] : [248, 113, 113] as [number,number,number]));
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${isIncoming ? "+" : "-"}${fmtAmt(tx.amount)}`, W / 2, 64, { align: "center" });

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(tx.type.replace(/_/g, " ").toUpperCase(), W / 2, 72, { align: "center" });

  doc.setDrawColor(51, 65, 85);
  doc.line(10, 78, W - 10, 78);

  const rows: [string, string][] = [
    ["Transaction ID", tx.txId ?? `#${tx.id}`],
    ["Type", tx.type.replace(/_/g, " ")],
    ["Status", tx.status],
    ["Submitted", fmtDt(tx.createdAt)],
    ...(tx.updatedAt && tx.updatedAt !== tx.createdAt && tx.status !== "pending"
      ? [["Processed", fmtDt(tx.updatedAt)] as [string, string]]
      : []),
    ...(tx.network ? [["Network", tx.network] as [string, string]] : []),
    ...(tx.fee && tx.fee > 0 ? [["Fee", fmtAmt(tx.fee)] as [string, string]] : []),
    ...(tx.address ? [["Address", tx.address.length > 30 ? tx.address.slice(0, 14) + "…" + tx.address.slice(-10) : tx.address] as [string, string]] : []),
    ...(tx.txHash ? [["TX Hash", tx.txHash.slice(0, 20) + "…"] as [string, string]] : []),
  ];

  let y = 88;
  for (const [label, value] of rows) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, 12, y);
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(value, W - 12, y, { align: "right" });
    doc.setDrawColor(30, 41, 59);
    doc.line(12, y + 3, W - 12, y + 3);
    y += 11;
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(
      `VaultX|${tx.txId ?? tx.id}|${tx.amount}|${tx.status}`,
      { width: 200, margin: 1, color: { dark: "#e2e8f0", light: "#1e293b" } }
    );
    const qrSize = 28;
    doc.addImage(qrDataUrl, "PNG", W / 2 - qrSize / 2, y + 4, qrSize, qrSize);
    y += qrSize + 10;
  } catch {}

  doc.setDrawColor(30, 41, 59);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, y + 2, W - 10, y + 2);
  doc.setLineDashPattern([], 0);

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated by ${settings.platformName} · ${new Date().toLocaleDateString()}`,
    W / 2, y + 8, { align: "center" }
  );

  doc.save(`VaultX-Receipt-${tx.txId ?? tx.id}.pdf`);
}
