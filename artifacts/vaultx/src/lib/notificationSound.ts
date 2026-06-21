const MUTE_KEY = "wexora-notifications-muted";

export function isNotificationMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
}

export function setNotificationMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? "true" : "false"); } catch {}
}

type SoundType = "notification" | "deposit" | "withdrawal" | "support" | "announcement" | "preview";

function createCtx() {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx() as AudioContext;
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, gain: GainNode) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);
  osc.connect(gain);
  osc.start(startTime);
  osc.stop(startTime + duration);
  return osc;
}

export function playNotificationSound(type: SoundType = "notification"): void {
  if (type !== "preview" && isNotificationMuted()) return;
  try {
    const ctx = createCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    switch (type) {
      case "deposit": {
        // Rising arpeggio — upbeat success
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        playTone(ctx, 523, now, 0.12, gain);       // C5
        playTone(ctx, 659, now + 0.12, 0.12, gain); // E5
        playTone(ctx, 784, now + 0.24, 0.20, gain); // G5
        playTone(ctx, 1047, now + 0.40, 0.28, gain); // C6
        break;
      }
      case "withdrawal": {
        // Descending resolution tone
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        playTone(ctx, 880, now, 0.15, gain);
        playTone(ctx, 784, now + 0.15, 0.15, gain);
        playTone(ctx, 659, now + 0.32, 0.30, gain);
        break;
      }
      case "support": {
        // Double soft ping — reply received
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        playTone(ctx, 1047, now, 0.14, gain);
        playTone(ctx, 1047, now + 0.22, 0.25, gain);
        break;
      }
      case "announcement": {
        // Bright triple chime
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        playTone(ctx, 659, now, 0.12, gain);
        playTone(ctx, 784, now + 0.14, 0.12, gain);
        playTone(ctx, 1047, now + 0.28, 0.40, gain);
        break;
      }
      case "preview": {
        // Friendly enable-sound confirmation tone
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        playTone(ctx, 784, now, 0.12, gain);
        playTone(ctx, 1047, now + 0.16, 0.28, gain);
        break;
      }
      default: {
        // Generic: two-tone ping
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        playTone(ctx, 880, now, 0.12, gain);
        playTone(ctx, 1100, now + 0.10, 0.40, gain);
        break;
      }
    }

    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}
