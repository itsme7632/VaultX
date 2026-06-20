import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, Smartphone, RefreshCw, Calendar, HardDrive, Tag,
  CheckCircle2, XCircle, ArrowUpCircle, Bell, Shield, Info,
  AlertTriangle, Zap,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const VERSION_KEY = "vaultx-installed-version";

interface AppInfo {
  appName: string;
  version: string;
  size: string;
  lastUpdated: string;
  releaseNotes: string;
  changelog: string;
  forceUpdateEnabled: boolean;
  primaryUrl: string;
  mirrorUrl: string;
  backupUrl: string;
  githubUrl: string;
  mediafireUrl: string;
  gdriveUrl: string;
  telegramUrl: string;
  primaryCount: number;
  mirrorCount: number;
  backupCount: number;
  githubCount: number;
  mediafireCount: number;
  gdriveCount: number;
  telegramCount: number;
}

type SourceKey = "primary" | "mirror" | "backup" | "github" | "mediafire" | "gdrive" | "telegram";

interface SourceConfig {
  key: SourceKey;
  label: string;
  sub: string;
  urlKey: keyof AppInfo;
  countKey: keyof AppInfo;
  gradient: string;
  accentColor: string;
  letter: string;
}

const SOURCES: SourceConfig[] = [
  {
    key: "primary",
    label: "Download APK",
    sub: "Primary server",
    urlKey: "primaryUrl",
    countKey: "primaryCount",
    gradient: "from-blue-600 to-indigo-700",
    accentColor: "#2563eb",
    letter: "P",
  },
  {
    key: "mirror",
    label: "Mirror Download",
    sub: "Mirror server",
    urlKey: "mirrorUrl",
    countKey: "mirrorCount",
    gradient: "from-violet-500 to-purple-700",
    accentColor: "#8b5cf6",
    letter: "M",
  },
  {
    key: "backup",
    label: "Backup Download",
    sub: "Backup server",
    urlKey: "backupUrl",
    countKey: "backupCount",
    gradient: "from-emerald-500 to-teal-600",
    accentColor: "#10b981",
    letter: "B",
  },
  {
    key: "github",
    label: "GitHub Releases",
    sub: "github.com",
    urlKey: "githubUrl",
    countKey: "githubCount",
    gradient: "from-gray-600 to-gray-800",
    accentColor: "#6b7280",
    letter: "G",
  },
  {
    key: "mediafire",
    label: "MediaFire",
    sub: "mediafire.com",
    urlKey: "mediafireUrl",
    countKey: "mediafireCount",
    gradient: "from-rose-500 to-red-600",
    accentColor: "#ef4444",
    letter: "M",
  },
  {
    key: "gdrive",
    label: "Google Drive",
    sub: "drive.google.com",
    urlKey: "gdriveUrl",
    countKey: "gdriveCount",
    gradient: "from-blue-500 to-cyan-600",
    accentColor: "#0ea5e9",
    letter: "D",
  },
  {
    key: "telegram",
    label: "Telegram Channel",
    sub: "t.me",
    urlKey: "telegramUrl",
    countKey: "telegramCount",
    gradient: "from-[#0088cc] to-[#006ba3]",
    accentColor: "#0088cc",
    letter: "T",
  },
];

// ─── Force Update Gate ────────────────────────────────────────────────────────
function ForceUpdateScreen({
  appInfo,
  activeSources,
  onDownload,
  downloading,
}: {
  appInfo: AppInfo;
  activeSources: SourceConfig[];
  onDownload: (key: SourceKey, url: string) => void;
  downloading: SourceKey | null;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-5">
        <AlertTriangle size={36} className="text-amber-500" />
      </div>
      <h1 className="text-2xl font-black text-foreground mb-2">Update Required</h1>
      <p className="text-muted-foreground text-sm mb-1">
        VaultX <span className="font-bold text-amber-500">v{appInfo.version}</span> is now available.
      </p>
      <p className="text-muted-foreground text-xs mb-8">
        Please update the app to continue using VaultX.
      </p>

      <div className="w-full max-w-sm space-y-3">
        {activeSources.map(({ key, label, urlKey, gradient }) => {
          const url = appInfo[urlKey] as string;
          const isActive = downloading === key;
          return (
            <button
              key={key}
              onClick={() => onDownload(key, url)}
              disabled={!!downloading}
              className={cn(
                "w-full h-13 px-4 py-3.5 rounded-2xl bg-gradient-to-r text-white font-semibold text-sm flex items-center justify-center gap-2",
                gradient,
                "hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
              )}
            >
              {isActive ? (
                <><RefreshCw size={15} className="animate-spin" /> Opening…</>
              ) : (
                <><Download size={15} /> {label}</>
              )}
            </button>
          );
        })}

        {activeSources.length === 0 && (
          <div className="bg-muted/50 rounded-2xl p-6 text-center">
            <Smartphone size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No download links configured. Please contact support.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DownloadAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState<SourceKey | null>(null);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);

  useEffect(() => {
    try {
      setInstalledVersion(localStorage.getItem(VERSION_KEY));
    } catch {}
  }, []);

  const { data: appInfo, isLoading } = useQuery<AppInfo>({
    queryKey: ["app-info"],
    queryFn: () => fetch("/api/app-info", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30000,
    retry: 1,
  });

  const activeSources = SOURCES.filter((s) => !!(appInfo?.[s.urlKey] as string));

  const latestVersion = appInfo?.version ?? "";
  const hasInstalledBefore = !!installedVersion;
  const isUpdateAvailable = hasInstalledBefore && latestVersion && installedVersion !== latestVersion;
  const isUpToDate = hasInstalledBefore && latestVersion && installedVersion === latestVersion;
  const isForceUpdate = !!(appInfo?.forceUpdateEnabled) && isUpdateAvailable;

  const handleDownload = async (key: SourceKey, url: string) => {
    if (downloading || !url) return;
    setDownloading(key);
    try {
      await fetch(`/api/app-info/download/${key}`, { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["app-info"] });
    } catch {}

    // Mark this version as "installed" when user downloads
    if (latestVersion) {
      try { localStorage.setItem(VERSION_KEY, latestVersion); } catch {}
      setInstalledVersion(latestVersion);
    }

    window.open(url, "_blank", "noopener,noreferrer");
    toast({ title: "Download Started", description: "Your download has opened. Enable 'Install from Unknown Sources' before installing." });
    setTimeout(() => setDownloading(null), 2000);
  };

  if (isLoading) {
    return (
      <AppLayout title="Download App">
        <div className="px-4 pt-5 pb-24 space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      </AppLayout>
    );
  }

  // ── Force Update Gate ─────────────────────────────────────────────────────
  if (isForceUpdate) {
    return (
      <ForceUpdateScreen
        appInfo={appInfo!}
        activeSources={activeSources}
        onDownload={handleDownload}
        downloading={downloading}
      />
    );
  }

  return (
    <AppLayout title="Download App">
      <div className="pb-24">

        {/* ── Hero ── */}
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
                  {new Date(appInfo.lastUpdated).toLocaleDateString("en-US", {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-5 space-y-4">

          {/* ── Version status card ── */}
          {latestVersion && (
            isUpdateAvailable ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <ArrowUpCircle size={20} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground">New Update Available</p>
                    <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">NEW</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Current: <span className="font-semibold text-foreground">v{installedVersion}</span></span>
                    <span>Latest: <span className="font-semibold text-amber-500">v{latestVersion}</span></span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Download the latest version below to update.</p>
                </div>
              </div>
            ) : isUpToDate ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 items-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">You are using the latest version</p>
                  <p className="text-xs text-muted-foreground mt-0.5">VaultX v{installedVersion} is up to date.</p>
                </div>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 items-center">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Zap size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Latest Version: v{latestVersion}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Download now to get the latest features.</p>
                </div>
              </div>
            )
          )}

          {/* ── App info card ── */}
          {(appInfo?.version || appInfo?.size || appInfo?.lastUpdated) && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">App Information</p>
              </div>
              {[
                appInfo?.appName && ["App Name", appInfo.appName],
                appInfo?.version && ["Latest Version", `v${appInfo.version}`],
                appInfo?.size && ["File Size", appInfo.size],
                appInfo?.lastUpdated && ["Release Date", new Date(appInfo.lastUpdated).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })],
                installedVersion && ["Installed Version", `v${installedVersion}`],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 gap-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Download buttons — only render configured links ── */}
          {activeSources.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Download Options</p>
              {activeSources.map(({ key, label, sub, urlKey, countKey, gradient, letter }) => {
                const url = appInfo![urlKey] as string;
                const count = appInfo![countKey] as number;
                const isActive = downloading === key;
                return (
                  <div key={key} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm", gradient)}>
                          <span className="text-white font-black text-base">{letter}</span>
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
                      className={cn("w-full h-11 font-semibold gap-2 text-sm bg-gradient-to-r", gradient, "hover:opacity-90 border-0 text-white")}
                      onClick={() => handleDownload(key, url)}
                      disabled={!!downloading}
                    >
                      {isActive ? (
                        <><RefreshCw size={15} className="animate-spin" /> Opening…</>
                      ) : (
                        <><Download size={15} /> {label}</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm text-center">
              <Smartphone size={32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-foreground">No Download Source Available</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                No download links have been configured yet. Please contact support for assistance.
              </p>
            </div>
          )}

          {/* ── What's New ── */}
          {appInfo?.releaseNotes && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-primary" />
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">What's New</p>
              </div>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{appInfo.releaseNotes}</p>
            </div>
          )}

          {/* ── Changelog ── */}
          {appInfo?.changelog && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-muted-foreground" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Changelog</p>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{appInfo.changelog}</p>
            </div>
          )}

          {/* ── Installation note ── */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-amber-500" />
              <p className="text-xs font-bold text-foreground">Installation Guide</p>
            </div>
            <div className="space-y-2">
              {[
                "Download the APK file from any source above.",
                "Open your device Settings → Security.",
                'Enable "Install from Unknown Sources" or "Allow from this source".',
                "Open the downloaded APK file and tap Install.",
                "Launch VaultX and sign in to your account.",
              ].map((step, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-3">
              Android only · iOS not supported
            </p>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
