import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, Smartphone, RefreshCw, Calendar, HardDrive, Tag,
  CheckCircle2, XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AppInfo {
  appName: string;
  version: string;
  size: string;
  lastUpdated: string;
  releaseNotes: string;
  changelog: string;
  githubUrl: string;
  mediafireUrl: string;
  gdriveUrl: string;
  telegramUrl: string;
  primaryUrl: string;
  mirrorUrl: string;
  backupUrl: string;
  githubCount: number;
  mediafireCount: number;
  gdriveCount: number;
  telegramCount: number;
  primaryCount: number;
  mirrorCount: number;
  backupCount: number;
}

type MirrorKey = "github" | "mediafire" | "gdrive" | "telegram" | "primary" | "mirror" | "backup";

interface MirrorConfig {
  key: MirrorKey;
  label: string;
  sub: string;
  urlKey: keyof AppInfo;
  countKey: keyof AppInfo;
  gradient: string;
  icon: string;
}

const MIRRORS: MirrorConfig[] = [
  {
    key: "github", label: "GitHub Releases", sub: "github.com",
    urlKey: "githubUrl", countKey: "githubCount",
    gradient: "from-gray-700 to-gray-900", icon: "G",
  },
  {
    key: "mediafire", label: "MediaFire", sub: "mediafire.com",
    urlKey: "mediafireUrl", countKey: "mediafireCount",
    gradient: "from-rose-500 to-red-600", icon: "M",
  },
  {
    key: "gdrive", label: "Google Drive", sub: "drive.google.com",
    urlKey: "gdriveUrl", countKey: "gdriveCount",
    gradient: "from-blue-500 to-indigo-600", icon: "D",
  },
  {
    key: "telegram", label: "Telegram Channel", sub: "t.me",
    urlKey: "telegramUrl", countKey: "telegramCount",
    gradient: "from-[#0088cc] to-[#006ba3]", icon: "T",
  },
  {
    key: "primary", label: "Primary Server", sub: "Direct download",
    urlKey: "primaryUrl", countKey: "primaryCount",
    gradient: "from-primary to-blue-600", icon: "P",
  },
  {
    key: "mirror", label: "Mirror Server", sub: "Alternative link",
    urlKey: "mirrorUrl", countKey: "mirrorCount",
    gradient: "from-violet-500 to-purple-700", icon: "M",
  },
  {
    key: "backup", label: "Backup Server", sub: "Fallback link",
    urlKey: "backupUrl", countKey: "backupCount",
    gradient: "from-emerald-500 to-teal-600", icon: "B",
  },
];

export default function DownloadAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState<MirrorKey | null>(null);

  const { data: appInfo, isLoading } = useQuery<AppInfo>({
    queryKey: ["app-info"],
    queryFn: () => fetch("/api/app-info", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30000,
    retry: 1,
  });

  const handleDownload = async (key: MirrorKey, url: string) => {
    if (downloading || !url) return;
    setDownloading(key);
    try {
      await fetch(`/api/app-info/download/${key}`, { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["app-info"] });
    } catch {}
    window.open(url, "_blank", "noopener,noreferrer");
    toast({ title: "Download Started", description: "Your download has been opened. If nothing happened, check your browser's pop-up settings." });
    setTimeout(() => setDownloading(null), 2000);
  };

  const activeMirrors = MIRRORS.filter((m) => appInfo?.[m.urlKey]);

  if (isLoading) {
    return (
      <AppLayout title="Download App">
        <div className="px-4 pt-5 pb-24 space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Download App">
      <div className="pb-24">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-primary via-blue-600 to-blue-800 px-4 pt-5 pb-8 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white translate-x-12 -translate-y-12" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white -translate-x-8 translate-y-8" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/20">
              <span className="text-2xl font-black text-white">V</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white">{appInfo?.appName ?? "VaultX"}</h1>
              <p className="text-blue-200 text-sm mt-0.5">Crypto Investment Platform</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {appInfo?.version && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
                <Tag size={11} className="text-blue-200" />
                <span className="text-xs font-semibold text-white">v{appInfo.version}</span>
              </div>
            )}
            {appInfo?.size && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
                <HardDrive size={11} className="text-blue-200" />
                <span className="text-xs font-semibold text-white">{appInfo.size}</span>
              </div>
            )}
            {appInfo?.lastUpdated && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
                <Calendar size={11} className="text-blue-200" />
                <span className="text-xs font-semibold text-white">
                  {new Date(appInfo.lastUpdated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-5 space-y-4">

          {/* Mirror status grid */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Mirror Status</p>
            <div className="grid grid-cols-3 gap-2">
              {MIRRORS.map(({ key, label, urlKey }) => {
                const online = !!(appInfo?.[urlKey]);
                return (
                  <div key={key} className={cn(
                    "rounded-xl border px-2 py-2.5 text-center",
                    online
                      ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800"
                      : "border-border bg-muted/30"
                  )}>
                    {online
                      ? <CheckCircle2 size={15} className="mx-auto text-emerald-500 mb-1" />
                      : <XCircle size={15} className="mx-auto text-muted-foreground/40 mb-1" />
                    }
                    <p className="text-[9px] font-bold text-foreground leading-tight">{label.split(" ")[0]}</p>
                    <p className={cn("text-[9px] font-semibold mt-0.5", online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {online ? "Online" : "Offline"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Download buttons */}
          {activeMirrors.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Download Options</p>
              {activeMirrors.map(({ key, label, sub, urlKey, countKey, gradient, icon }) => {
                const url = appInfo?.[urlKey] as string;
                const count = appInfo?.[countKey] as number;
                const isActive = downloading === key;
                return (
                  <div key={key} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm", gradient)}>
                          <span className="text-white font-black text-base">{icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Online</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">{sub}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        <Download size={9} className="inline mr-0.5" />
                        {(count ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      className={cn("w-full h-11 font-semibold gap-2 text-sm bg-gradient-to-r", gradient, "hover:opacity-90 border-0")}
                      onClick={() => handleDownload(key, url)}
                      disabled={!!downloading}
                    >
                      {isActive ? (
                        <><RefreshCw size={15} className="animate-spin" /> Opening…</>
                      ) : (
                        <><Download size={15} /> Download from {label.split(" ")[0]}</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm text-center">
              <Smartphone size={32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-foreground">No Downloads Available</p>
              <p className="text-xs text-muted-foreground mt-1">The app download links have not been configured yet. Please check back soon.</p>
            </div>
          )}

          {/* Release notes */}
          {appInfo?.releaseNotes && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">What's New</p>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{appInfo.releaseNotes}</p>
            </div>
          )}

          {/* Changelog */}
          {appInfo?.changelog && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Changelog</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{appInfo.changelog}</p>
            </div>
          )}

          {/* Installation note */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">Installation Note</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
              This is an Android APK file. Before installing, enable <strong>Install from Unknown Sources</strong> in your Android Settings → Security. iOS is not supported.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
