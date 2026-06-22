import { useQuery } from "@tanstack/react-query";

export interface PlanMetricsItem {
  id: number;
  participants: number;
  capitalRaised: number;
  fundingGoal: number;
  fundingPct: number;
  fundingDisplay: string;
  barPct: number;
  capitalRemaining: number;
  joinedToday: number;
  joinedWeek: number;
}

export interface PlatformMetrics {
  totalRaised: number;
  totalTarget: number;
  fundingPercentage: number;
  totalParticipants: number;
  activeOpportunities: number;
  capitalDeployed: number;
  activeInvestments: number;
  distributionsPaid: number;
  mostPopular: { id: number; name: string; participants: number } | null;
  topFunded: { id: number; name: string; fundingPct: number } | null;
  fastestGrowing: { id: number; name: string } | null;
  plans: PlanMetricsItem[];
}

export const PLATFORM_METRICS_QUERY_KEY = ["platform-metrics"];

export function usePlatformMetrics() {
  return useQuery<PlatformMetrics>({
    queryKey: PLATFORM_METRICS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/platform-metrics", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch platform metrics");
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function formatMetricCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
