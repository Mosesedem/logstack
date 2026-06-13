"use client";

import { cn } from "@/lib/utils";
import { LogLevel } from "@/types";

interface LevelBadgeProps {
  level: LogLevel;
  className?: string;
}

const levelColors: Record<LogLevel, string> = {
  debug: "bg-purple-500/20 text-purple-400",
  info: "bg-blue-500/20 text-blue-500",
  warn: "bg-yellow-500/20 text-yellow-500",
  error: "bg-red-500/20 text-red-500",
  critical: "bg-red-700/20 text-red-700",
  fatal: "bg-purple-700/20 text-purple-700",
};

export function LevelBadge({ level, className }: LevelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium uppercase",
        levelColors[level],
        className,
      )}
    >
      {level}
    </span>
  );
}
