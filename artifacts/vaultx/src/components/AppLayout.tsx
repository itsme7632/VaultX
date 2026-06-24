import { ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { X, Megaphone, Bell } from "lucide-react";
import { useAppMode } from "@/lib/useAppMode";

function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const text = settings?.announcement_text?.trim();
  if (!text || dismissed) return null;

  return (
    <div className="bg-primary text-white px-3 py-2 flex items-center gap-2 max-w-screen-sm mx-auto w-full">
      <Megaphone size={13} className="shrink-0 opacity-80" />
      <p className="text-xs flex-1 leading-snug">{text}</p>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-70 hover:opacity-100 p-0.5">
        <X size={13} />
      </button>
    </div>
  );
}

const DISMISSED_KEY = "wexora_dismissed_announcements";

function getDismissedIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function dismissId(id: number) {
  const ids = getDismissedIds();
  if (!ids.includes(id)) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids, id]));
  }
}

function AnnouncementPopup() {
  const [dismissed, setDismissed] = useState<number[]>(getDismissedIds);

  const { data: announcements } = useQuery<any[]>({
    queryKey: ["announcements-active"],
    queryFn: () =>
      fetch("/api/announcements/active", { credentials: "include" }).then((r) => {
        if (!r.ok) return [];
        return r.json();
      }),
    staleTime: 60000,
    retry: false,
  });

  const visible = (announcements ?? []).find((a: any) => !dismissed.includes(a.id));

  if (!visible) return null;

  const handleDismiss = () => {
    dismissId(visible.id);
    setDismissed(getDismissedIds());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl max-w-sm w-full mx-auto overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Bell size={14} className="text-white" />
          </div>
          <p className="text-sm font-bold text-white flex-1 leading-snug">{visible.title}</p>
          <button onClick={handleDismiss} className="p-1 rounded-full hover:bg-white/20 transition-colors shrink-0">
            <X size={15} className="text-white" />
          </button>
        </div>
        {/* Body */}
        <div className="px-4 py-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{visible.message}</p>
        </div>
        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={handleDismiss}
            className="w-full h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children, title, noPad }: { children: ReactNode; title?: string; noPad?: boolean }) {
  const { isApp } = useAppMode();

  useEffect(() => {
    if (isApp) {
      document.documentElement.classList.add("app-mode");
    } else {
      document.documentElement.classList.remove("app-mode");
    }
  }, [isApp]);

  return (
    <div className={`bg-background flex flex-col ${noPad ? "h-dvh" : "min-h-screen"}`}>
      <TopBar title={title} />
      <AnnouncementBanner />
      <main className={`flex-1 max-w-screen-sm mx-auto w-full ${noPad ? "min-h-0 overflow-hidden flex flex-col pb-20" : "pb-24"}`}>
        {children}
      </main>
      <BottomNav />
      <AnnouncementPopup />
    </div>
  );
}
