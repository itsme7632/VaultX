import { ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { X, Megaphone } from "lucide-react";
import { useState } from "react";
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
    </div>
  );
}
