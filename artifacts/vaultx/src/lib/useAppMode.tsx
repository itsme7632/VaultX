import { useEffect, useState } from "react";

export type AppMode = "browser" | "webview" | "pwa";

function detectAppMode(): AppMode {
  if (typeof window === "undefined") return "browser";
  const ua = navigator.userAgent || "";
  const isStandalone =
    ("standalone" in navigator && (navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches;
  if (isStandalone) return "pwa";
  const isWebView =
    /wv/.test(ua) ||
    /WebView/.test(ua) ||
    (/Android/.test(ua) && !/Chrome\/[.0-9]*\s+Mobile/.test(ua) && /Version\//.test(ua)) ||
    /AppGeyser/.test(ua) ||
    (!/Chrome/.test(ua) && /Android/.test(ua));
  if (isWebView) return "webview";
  return "browser";
}

export function useAppMode(): { mode: AppMode; isApp: boolean } {
  const [mode, setMode] = useState<AppMode>(() => detectAppMode());

  useEffect(() => {
    setMode(detectAppMode());
  }, []);

  return { mode, isApp: mode !== "browser" };
}
