import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Server, CheckCircle2, XCircle, Smartphone, RefreshCw, Calendar, HardDrive, Tag } from "lucide-react";
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
  primaryUrl: string;
  mirrorUrl: string;
  backupUrl: string;
  primaryCount: number;
  mirrorCount: number;
  backupCount: number;
}

type ServerKey = "primary" | "mirror" | "backup";

const SERVER_CONFIG: { key: ServerKey; label: string; urlKey: keyof AppInfo; countKey: keyof AppInfo }[] = [
  { key: "primary", label: "Primary Server", urlKey: "primaryUrl", countKey: "primaryCount" },
  { key: "mirror", label: "Mirror Server", urlKey: "mirrorUrl", countKey: "mirrorCount" },
  { key: "backup", label: "Backup Server", urlKey: "backupUrl", countKey: "backupCount" },
];

export default function DownloadAppPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState<ServerKey | null>(null);

  const { data: appInfo, isLoading, error } = useQuery<AppInfo>({
    queryKey: ["app-info"],
    queryFn: () => fetch("/api/app-info", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30000,
    retry: 1,
  });

  const handleDownload = async (server: ServerKey, url: string) => {
    if (downloading || !url) return;
    setDownloading(server);
    try {
      await fetch(`/api/app-info/download/${server}`, {
        method: "POST",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["app-info"] });
    } catch {
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast({
      title: "Download Started",
      description: "Your download has been opened. If nothing happened, check your browser's pop-up settings.",
    });
    setTimeout(() => setDownloading(null), 2000);
  };

  const hasAnyUrl = appInfo && (appInfo.primaryUrl || appInfo.mirrorUrl || appInfo.backupUrl);

  if (isLoading) {
    return (
      <AppLayout title="Download App">
        <div className="px-4 pt-5 pb-24 space-y-4">
          <div className="h-40 rounded-2xl bg-muted animate-pulse" />
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
          <div className="h-32 rounded-2xl bg-muted animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Download App">
      <div className="pb-24">
        {/* Hero header */}
        <div className="relative bg-gradient-to-br from-primary via-blue-600 to-blue-800 px-4 pt-5 pb-8 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white translate-x-12 -translate-y-12" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white -translate-x-8 translate-y-8" />
          </div>
          <button onClick={() => setLocation("/settings")} className="flex items-center gap-1.5 text-white/80 text-sm mb-5 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/20">
              <span className="text-2xl font-black text-white">V</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white">{appInfo?.appName ?? "VaultX"}</h1>
              <p className="text-blue-200 text-sm mt-0.5">Crypto Investment Platform</p>
            </div>
          </div>

          {/* Meta chips */}
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
          {/* Server status overview */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server size={14} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground">Server Status</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SERVER_CONFIG.map(({ key, label, urlKey }) => {
                const url = appInfo?.[urlKey] as string | undefined;
                const online = !!url;
                return (
                  <div key={key} className={cn(
                    "rounded-xl border px-2.5 py-2.5 text-center",
                    online ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-border bg-muted/30"
                  )}>
                    {online
                      ? <CheckCircle2 size={16} className="mx-auto text-emerald-500 mb-1" />
                      : <XCircle size={16} className="mx-auto text-muted-foreground/50 mb-1" />
                    }
                    <p className="text-[10px] font-bold text-foreground">{label.split(" ")[0]}</p>
                    <p className={cn("text-[10px] font-semibold mt-0.5", online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {online ? "Online" : "Offline"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Download buttons */}
          {hasAnyUrl ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">Download Options</p>
              {SERVER_CONFIG.map(({ key, label, urlKey, countKey }) => {
                const url = appInfo?.[urlKey] as string;
                const count = appInfo?.[countKey] as number;
                if (!url) return null;
                const isActive = downloading === key;
                return (
                  <div
                    key={key}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Smartphone size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{label}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Online</span>
                            </span>
                            <span className="text-muted-foreground text-[10px]">·</span>
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Download size={9} className="inline" />
                              {count?.toLocaleString() ?? 0} downloads
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      className={cn(
                        "w-full h-11 font-semibold gap-2 text-sm",
                        isActive && "opacity-80"
                      )}
                      onClick={() => handleDownload(key, url)}
                      disabled={!!downloading}
                    >
                      {isActive ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          Opening…
                        </>
                      ) : (
                        <>
                          <Download size={15} />
                          Download from {label.split(" ")[0]}
                        </>
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
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed text-muted-foreground">{appInfo.changelog}</p>
            </div>
          )}

          {/* Installation note */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">Installation Note</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
              This is an Android APK file. Before installing, enable <strong>Install from Unknown Sources</strong> in your Android Settings → Security. iOS installation is not supported.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
