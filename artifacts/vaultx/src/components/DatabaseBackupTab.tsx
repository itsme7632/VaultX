import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Upload,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
async function adminApi<T = any>(path: string, method = "GET", body?: any): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

interface ToastFn {
  (opts: { title: string; description?: string; variant?: "destructive" }): void;
}

interface BackupLog {
  id: number;
  type: string;
  status: string;
  backupVersion: string | null;
  schemaVersion: string | null;
  tableCount: number | null;
  recordCount: number | null;
  fileSizeBytes: number | null;
  fileName: string | null;
  errorMessage: string | null;
  restoreMode: string | null;
  createdAt: string;
}

interface BackupResult {
  fileName: string;
  fileSize: number;
  fileSizeMB: string;
  tableCount: number;
  recordCount: number;
  recordsByTable: Record<string, number>;
  createdAt: string;
  backupVersion: string;
  schemaVersion: string;
  checksum: string;
}

interface ValidationResult {
  valid: boolean;
  summary: {
    format: string;
    version: string;
    schemaVersion: string;
    platform: string;
    createdAt: string;
    tableCount: number;
    totalRecords: number;
    recordsByTable: Record<string, number>;
    checksum: string;
  };
  warnings: string[];
  conflicts: { duplicateUsers: number };
  missingInBackup: string[];
  extraInBackup: string[];
  readyToRestore: boolean;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DatabaseBackupTab({ toast }: { toast: ToastFn }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [backupData, setBackupData] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"full" | "merge">("full");
  const [uploadedData, setUploadedData] = useState<string | null>(null);
  const [showTableBreakdown, setShowTableBreakdown] = useState(false);

  // Fetch backup history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["admin-backup-history"],
    queryFn: () =>      adminApi<BackupLog[]>("/admin/backup/history"),
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: () =>
      adminApi<{ success: boolean; backup: BackupResult; data: string }>(
        "/admin/backup/create",
        "POST",
        {}
      ),
    onSuccess: (result) => {
      setBackupResult(result.backup);
      setBackupData(result.data);
      queryClient.invalidateQueries({ queryKey: ["admin-backup-history"] });
      toast({ title: "Backup created successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Backup failed", description: e?.message, variant: "destructive" });
    },
  });

  // Validate backup mutation
  const validateMutation = useMutation({
    mutationFn: (data: string) =>
      adminApi<ValidationResult>("/admin/backup/validate", "POST", { data }),
    onSuccess: (result) => {
      setValidationResult(result);
      if (result.valid) {
        toast({ title: "Backup validated successfully" });
      } else {
        toast({ title: "Backup validation failed", variant: "destructive" });
      }
    },
    onError: (e: any) => {
      toast({ title: "Validation failed", description: e?.message, variant: "destructive" });
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: ({ data, mode }: { data: string; mode: "full" | "merge" }) =>
      adminApi<{
        success: boolean;
        mode: string;
        totalRecordsRestored: number;
        preRestoreBackup: { id: number; records: number };
      }>("/admin/backup/restore", "POST", { data, mode }),
    onSuccess: (result) => {
      setShowRestoreConfirm(false);
      setValidationResult(null);
      setUploadedData(null);
      queryClient.invalidateQueries({ queryKey: ["admin-backup-history"] });
      toast({
        title: "Restore completed",
        description: `${result.totalRecordsRestored} records restored. Pre-restore backup #${result.preRestoreBackup.id} created.`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Restore failed", description: e?.message, variant: "destructive" });
    },
  });

  const handleDownloadBackup = () => {
    if (!backupData || !backupResult) return;
    const blob = new Blob([backupData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".wexora")) {
      toast({ title: "Invalid file type", description: "Please select a .wexora backup file", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setUploadedData(data);
      setValidationResult(null);
      validateMutation.mutate(data);
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Database size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Database Backup & Restore</h3>
            <p className="text-xs text-muted-foreground">
              Create encrypted backups or restore from a previous backup
            </p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            <strong>Important:</strong> Before restoring, the system automatically creates an emergency backup of the current database state.
          </p>
        </div>
      </div>

      {/* Create Backup */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">Create Backup</p>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
          >
            {createBackupMutation.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Creating…</>
            ) : (
              <><Download size={12} /> Create Full Backup</>
            )}
          </Button>
        </div>

        {backupResult && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Backup created successfully</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Tables</span>
                <span className="font-semibold text-foreground">{backupResult.tableCount}</span>
              </div>
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Records</span>
                <span className="font-semibold text-foreground">{backupResult.recordCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Size</span>
                <span className="font-semibold text-foreground">{backupResult.fileSizeMB} MB</span>
              </div>
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Schema</span>
                <span className="font-semibold text-foreground">{backupResult.schemaVersion}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowTableBreakdown(!showTableBreakdown)}
                className="text-xs text-primary underline flex items-center gap-1"
              >
                {showTableBreakdown ? <EyeOff size={10} /> : <Eye size={10} />}
                {showTableBreakdown ? "Hide" : "View"} table breakdown
              </button>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleDownloadBackup}>
                <Download size={12} /> Download Backup
              </Button>
            </div>

            {showTableBreakdown && (
              <div className="bg-white/30 dark:bg-black/10 rounded-xl p-3 space-y-1">
                {Object.entries(backupResult.recordsByTable)
                  .sort(([, a], [, b]) => b - a)
                  .map(([table, count]) => (
                    <div key={table} className="flex justify-between text-xs py-0.5">
                      <span className="text-muted-foreground font-mono">{table}</span>
                      <span className="font-semibold text-foreground">{count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Restore Backup */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Upload size={14} className="text-primary" />
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Restore Backup</p>
        </div>

        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wexora"
            className="hidden"
            onChange={handleFileUpload}
          />
          <FileText size={24} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground mb-2">Select a .wexora backup file</p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Validating…</>
            ) : (
              <><Upload size={12} /> Choose Backup File</>
            )}
          </Button>
        </div>

        {validationResult && (
          <div className={`border rounded-xl p-4 space-y-3 ${
            validationResult.valid
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center gap-2">
              {validationResult.valid ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <XCircle size={16} className="text-red-500" />
              )}
              <p className="text-sm font-semibold">
                {validationResult.valid ? "Validation successful — ready to restore" : "Validation failed"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Created</span>
                <span className="font-semibold text-foreground">{formatDate(validationResult.summary.createdAt)}</span>
              </div>
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-semibold text-foreground">{validationResult.summary.platform}</span>
              </div>
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Tables</span>
                <span className="font-semibold text-foreground">{validationResult.summary.tableCount}</span>
              </div>
              <div className="flex justify-between bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Records</span>
                <span className="font-semibold text-foreground">{validationResult.summary.totalRecords.toLocaleString()}</span>
              </div>
            </div>

            {validationResult.conflicts.duplicateUsers > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ {validationResult.conflicts.duplicateUsers} user(s) already exist in the database. Merge mode will skip duplicates.
                </p>
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="space-y-1">
                {validationResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠️ {w}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  value={restoreMode}
                  onChange={(e) => setRestoreMode(e.target.value as "full" | "merge")}
                  className="w-full h-8 text-xs border border-border rounded-lg px-2 bg-background"
                >
                  <option value="full">Full Restore (replaces all data)</option>
                  <option value="merge">Merge/Import (skip duplicates, safe tables only)</option>
                </select>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowRestoreConfirm(true)}
                disabled={!uploadedData || !validationResult.valid}
              >
                <RefreshCw size={12} /> Restore
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Backup History */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-primary" />
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Backup History</p>
        </div>

        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !historyData || historyData.length === 0 ? (
          <div className="text-center py-6">
            <Clock size={24} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No backup history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historyData.map((log) => (
              <div
                key={log.id}
                className="bg-muted/30 border border-border rounded-xl px-3 py-2.5 flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  log.type === "backup" ? "bg-blue-500/10" : log.type === "restore" ? "bg-amber-500/10" : "bg-purple-500/10"
                }`}>
                  {log.type === "backup" ? (
                    <Download size={13} className="text-blue-500" />
                  ) : log.type === "restore" ? (
                    <Upload size={13} className="text-amber-500" />
                  ) : (
                    <Eye size={13} className="text-purple-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground capitalize">{log.type}</span>
                    <Badge
                      variant={log.status === "success" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                      className="text-[9px] px-1.5 py-0"
                    >
                      {log.status}
                    </Badge>
                    {log.restoreMode && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{log.restoreMode}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{formatDate(log.createdAt)}</span>
                    {log.recordCount != null && <span>• {log.recordCount.toLocaleString()} records</span>}
                    {log.fileSizeBytes && <span>• {formatBytes(log.fileSizeBytes)}</span>}
                  </div>
                  {log.errorMessage && (
                    <p className="text-[10px] text-red-500 mt-0.5 truncate">{log.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm {restoreMode === "full" ? "Full" : "Merge"} Restore</DialogTitle>
            <DialogDescription>
              {restoreMode === "full" ? (
                <>
                  This will <strong>replace ALL existing data</strong> with the backup contents. A
                  pre-restore backup will be created automatically before proceeding.
                </>
              ) : (
                <>
                  This will import records from the backup into the existing database. Financial
                  data, users, and transactions will be skipped (merge mode is only for settings,
                  plans, and content tables).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>⚠️ This action cannot be undone.</strong> An emergency backup of the current state
              will be created automatically before the restore begins.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm"
              onClick={() => setShowRestoreConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-9 text-sm gap-1.5"
              onClick={() => {
                if (uploadedData) {
                  restoreMutation.mutate({ data: uploadedData, mode: restoreMode });
                }
              }}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? (
                <><Loader2 size={13} className="animate-spin" /> Restoring…</>
              ) : (
                <>Confirm {restoreMode === "full" ? "Full" : "Merge"} Restore</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
