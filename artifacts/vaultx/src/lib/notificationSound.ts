const MUTE_KEY = "vaultx-notifications-muted";

export function isNotificationMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
}

export function setNotificationMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? "true" : "false"); } catch {}
}

export function playNotificationSound(): void {
  if (isNotificationMuted()) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx() as AudioContext;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1100, now + 0.08);
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.55);

    osc1.onended = () => ctx.close().catch(() => {});
  } catch {}
}
