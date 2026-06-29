"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { UsageSummary } from "@/types";

function getTierName(tier?: string) {
  if (!tier) return "Free Plan";
  return tier.charAt(0).toUpperCase() + tier.slice(1) + " Plan";
}

function getUsageColor(percentage: number) {
  if (percentage >= 100) return "bg-red-500";
  if (percentage >= 80) return "bg-yellow-500";
  return "bg-primary";
}

export function SidebarUsage({ className }: { className?: string }) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await api.get<UsageSummary>("/billing/usage");
        setUsage(data);
      } catch (error) {
        console.error("Failed to load sidebar usage:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  return (
    <div className={cn("rounded-lg border bg-muted/50 p-4", className)}>
      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : usage ? (
        <>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              {getTierName(usage.tier)}
            </p>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                usage.isOverLimit
                  ? "bg-red-500/10 text-red-500"
                  : "bg-primary/10 text-primary",
              )}
            >
              {Math.round(usage.usagePercentage)}%
            </span>
          </div>
          <p className="mb-3 truncate text-[10px] text-muted-foreground">
            {usage.isOverLimit
              ? "Quota exceeded"
              : `${Math.round(usage.usagePercentage)}% of log quota used`}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full transition-all duration-500",
                getUsageColor(usage.usagePercentage),
              )}
              style={{ width: `${Math.min(usage.usagePercentage, 100)}%` }}
            />
          </div>
          {usage.usagePercentage >= 80 && (
            <Link
              href="/billing"
              className="mt-3 block text-center text-[10px] text-primary hover:underline"
            >
              Upgrade Plan
            </Link>
          )}
        </>
      ) : (
        <div className="py-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            Usage data unavailable
          </p>
        </div>
      )}
    </div>
  );
}