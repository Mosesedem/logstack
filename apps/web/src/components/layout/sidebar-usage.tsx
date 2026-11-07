"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronUp, CreditCard, LogOut, Settings, Smartphone, User } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SidebarWidgetSkeleton } from "@/components/loading";
import { LinkMobileDialog } from "@/components/auth/link-mobile-dialog";
import { LogoutConfirmDialog } from "@/components/auth/logout-confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function SidebarUsage({
  className,
  onLinkMobile,
  onRequestSignOut,
}: {
  className?: string;
  /** When set, the parent owns the link-mobile dialog (needed if this card unmounts). */
  onLinkMobile?: () => void;
  /** When set, the parent owns the sign-out dialog. */
  onRequestSignOut?: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkMobileOpen, setLinkMobileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const openLinkMobile = () => {
    if (onLinkMobile) onLinkMobile();
    else setLinkMobileOpen(true);
  };

  const openSignOut = () => {
    if (onRequestSignOut) onRequestSignOut();
    else setLogoutConfirmOpen(true);
  };

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await api.get<UsageSummary>("/billing/usage");
        setUsage(data);
      } catch {
        // Leave usage null — the widget already renders "Usage data unavailable".
        // Do not console.error: captureConsole would ingest this as a customer log.
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  const email = session?.user?.email;
  const nearLimit = (usage?.usagePercentage ?? 0) >= 80;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full rounded-lg border bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
            aria-label="Account menu"
          >
            {loading ? (
              <SidebarWidgetSkeleton className="p-0" />
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
                    style={{
                      width: `${Math.min(usage.usagePercentage, 100)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Usage data unavailable
              </p>
            )}

            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {email ?? "Account"}
              </span>
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="z-[120] w-[var(--radix-dropdown-menu-trigger-width)]"
        >
          {email ? (
            <>
              <div className="truncate px-2 py-1.5 text-sm text-muted-foreground">
                {email}
              </div>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={openLinkMobile}
          >
            <Smartphone className="h-4 w-4" />
            Link mobile app
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={() => router.push("/settings")}
          >
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={() => router.push("/billing")}
          >
            <CreditCard className="h-4 w-4" />
            {nearLimit ? "Upgrade plan" : "Billing"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            onSelect={openSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onLinkMobile ? null : (
        <LinkMobileDialog open={linkMobileOpen} onOpenChange={setLinkMobileOpen} />
      )}
      {onRequestSignOut ? null : (
        <LogoutConfirmDialog
          open={logoutConfirmOpen}
          onOpenChange={setLogoutConfirmOpen}
        />
      )}
    </>
  );
}
