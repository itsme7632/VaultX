import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { X, Megaphone, Smartphone, Download } from "lucide-react";
import { useState } from "react";

function usePublicSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });
}

function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: settings } = usePublicSettings();

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

function AppDownloadBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: settings } = usePublicSettings();

  const url = settings?.app_download_url?.trim();
  if (!url || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-2.5 flex items-center gap-3 max-w-screen-sm mx-auto w-full">
      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        <Smartphone size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-none">Get the Mobile App</p>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-none">Download for the best experience</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        <Download size={11} />
        Download
      </a>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-50 hover:opacity-100 p-0.5 ml-0.5">
        <X size={12} />
      </button>
    </div>
  );
}

export function AppLayout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title={title} />
      <AnnouncementBanner />
      <AppDownloadBanner />
      <main className="flex-1 pb-24 max-w-screen-sm mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
