"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface UsageProgressBarProps {
  current: number;
  limit: number;
  className?: string;
}

export function UsageProgressBar({
  current,
  limit,
  className,
}: UsageProgressBarProps) {
  const percentage = useMemo(() => {
    if (limit <= 0) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  }, [current, limit]);

  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="font-medium">
          {formatNumber(current)} /{" "}
          {limit <= 0 ? "Unlimited" : formatNumber(limit)} logs
        </span>
        <span
          className={cn(
            "font-medium",
            isOverLimit
              ? "text-red-500"
              : isNearLimit
                ? "text-yellow-500"
                : "text-green-500"
          )}
        >
          {limit <= 0 ? "Unlimited" : `${percentage.toFixed(1)}%`}
        </span>
      </div>

      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOverLimit
              ? "bg-red-500"
              : isNearLimit
                ? "bg-yellow-500"
                : "bg-green-500"
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {isNearLimit && !isOverLimit && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400">
          You&apos;re approaching your monthly limit. Consider upgrading your
          plan.
        </p>
      )}

      {isOverLimit && (
        <p className="text-xs text-red-600 dark:text-red-400">
          You&apos;ve exceeded your monthly limit. Log ingestion is blocked
          until next month or until you upgrade.
        </p>
      )}
    </div>
  );
}
