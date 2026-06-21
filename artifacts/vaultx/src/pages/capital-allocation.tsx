import { useState } from "react";
import { PieChart, Edit2, Save, X, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const DEFAULT_ALLOCATIONS = [
  { label: "Digital Assets", pct: 35, color: "from-blue-500 to-indigo-600", bg: "bg-blue-500", track: "bg-blue-100 dark:bg-blue-900/30" },
  { label: "Technology Infrastructure", pct: 25, color: "from-purple-500 to-violet-600", bg: "bg-purple-500", track: "bg-purple-100 dark:bg-purple-900/30" },
  { label: "AI Development", pct: 20, color: "from-emerald-500 to-teal-600", bg: "bg-emerald-500", track: "bg-emerald-100 dark:bg-emerald-900/30" },
  { label: "Strategic Growth", pct: 15, color: "from-amber-500 to-orange-600", bg: "bg-amber-500", track: "bg-amber-100 dark:bg-amber-900/30" },
  { label: "Reserve Fund", pct: 5, color: "from-slate-500 to-gray-600", bg: "bg-slate-500", track: "bg-slate-100 dark:bg-slate-800" },
];

async function loadAllocation() {
  const res = await fetch("/api/settings/public", { credentials: "include" });
  const data = await res.json();
  if (data?.capital_allocation) {
    try { return JSON.parse(data.capital_allocation); } catch {}
  }
  return DEFAULT_ALLOCATIONS;
}

async function saveAllocation(allocations: typeof DEFAULT_ALLOCATIONS) {
  const res = await fetch("/api/admin/settings", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capital_allocation: JSON.stringify(allocations) }),
  });
  if (!res.ok) throw new Error("Failed to save");
  return res.json();
}

function AllocationBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-3 bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function CapitalAllocationPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = (user as any)?.isAdmin;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<typeof DEFAULT_ALLOCATIONS>([]);

  const { data: allocations = DEFAULT_ALLOCATIONS, isLoading } = useQuery({
    queryKey: ["capital-allocation"],
    queryFn: loadAllocation,
    staleTime: 60000,
  });

  const save = useMutation({
    mutationFn: saveAllocation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capital-allocation"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      setEditing(false);
    },
  });

  const startEdit = () => {
    setDraft(allocations.map((a: any) => ({ ...a })));
    setEditing(true);
  };

  const total = draft.reduce((s: number, a: any) => s + (parseFloat(String(a.pct)) || 0), 0);

  const current = editing ? draft : allocations;

  return (
    <AppLayout title="Capital Allocation">
      <div className="px-4 pt-5 pb-24 space-y-5">

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-primary/80 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <PieChart size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Capital Allocation</h2>
              <p className="text-white/60 text-xs">Platform portfolio composition</p>
            </div>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            Our capital is strategically deployed across multiple sectors to optimize returns while managing risk exposure across diverse asset classes.
          </p>
        </div>

        {/* Donut-style visual summary */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-sm text-foreground">Portfolio Breakdown</p>
            {isAdmin && !editing && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={startEdit}>
                <Edit2 size={12} /> Edit
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {current.map((alloc: any, i: number) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", alloc.bg ?? "bg-primary")} />
                      <span className="text-sm font-medium text-foreground">{alloc.label}</span>
                    </div>
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={draft[i]?.pct ?? ""}
                          onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, pct: parseFloat(e.target.value) || 0 } : x))}
                          className="w-16 h-7 text-xs text-center px-1"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-foreground">{alloc.pct}%</span>
                    )}
                  </div>
                  <AllocationBar pct={alloc.pct} color={alloc.color ?? "from-primary to-blue-600"} />
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">Total allocation</p>
                <p className={cn("text-sm font-bold", total === 100 ? "text-emerald-600" : "text-destructive")}>{total}%</p>
              </div>
              {total !== 100 && (
                <p className="text-xs text-destructive mb-3">Allocations must sum to 100%</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-9 text-sm gap-1.5" onClick={() => setEditing(false)}>
                  <X size={13} /> Cancel
                </Button>
                <Button
                  className="flex-1 h-9 text-sm gap-1.5"
                  disabled={total !== 100 || save.isPending}
                  onClick={() => save.mutate(draft)}
                >
                  <Save size={13} /> {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sector cards */}
        <div>
          <p className="font-semibold text-sm text-foreground mb-3">Sector Overview</p>
          <div className="grid grid-cols-1 gap-3">
            {(isLoading ? DEFAULT_ALLOCATIONS : allocations).map((alloc: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0", alloc.color ?? "from-primary to-blue-600")}>
                  <span className="text-white font-bold text-lg">{alloc.pct}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{alloc.label}</p>
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full bg-gradient-to-r", alloc.color ?? "from-primary to-blue-600")} style={{ width: `${alloc.pct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-muted/40 border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Capital allocation percentages represent target portfolio weights and may vary slightly due to market conditions. Rebalancing occurs periodically to maintain optimal exposure across sectors.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
