"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  FileText,
  Bell,
  FolderOpen,
  Settings,
  Ship,
  CreditCard,
  Loader2,
  Users,
  LayoutDashboard,
  FlaskConical,
} from "lucide-react";
import type { UsageSummary } from "@/types";

export const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/demo", label: "SDK Demo", icon: FlaskConical },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/team", label: "Team", icon: Users },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await api.get<UsageSummary>("/billing/usage");
        setUsage(data);
      } catch (error) {
        // Silently fail for sidebar to avoid noise
        console.error("Failed to load sidebar usage:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  const getTierName = (tier?: string) => {
    if (!tier) return "Free Plan";
    return tier.charAt(0).toUpperCase() + tier.slice(1) + " Plan";
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <aside
      className={cn(
        "w-64 border-r border-border bg-background/50 backdrop-blur-md hidden md:flex flex-col",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-xl tracking-tight text-white hover:opacity-80 transition-opacity"
          // onClick={() => setIsOpen(false)}
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg ">
            <svg
              className="h-7 w-7 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5z"
                fill="currentColor"
                opacity="0.8"
              />
              <path
                d="M2 17l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Logstack
        </Link>
      </div>
      <nav className="p-4 space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/5",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Usage Quota Section */}
      <div className="p-4 border-t border-white/10">
        <div className="rounded-lg p-4 border bg-card/50">
          {loading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : usage ? (
            <>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-medium text-foreground">
                  {getTierName(usage.tier)}
                </p>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    usage.isOverLimit
                      ? "bg-red-500/10 text-red-500"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {Math.round(usage.usagePercentage)}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3 truncate">
                {usage.isOverLimit
                  ? "Quota exceeded"
                  : `${Math.round(usage.usagePercentage)}% of log quota used`}
              </p>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
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
                  className="block mt-3 text-[10px] text-primary hover:underline text-center"
                >
                  Upgrade Plan
                </Link>
              )}
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-[10px] text-muted-foreground">
                Usage data unavailable
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
