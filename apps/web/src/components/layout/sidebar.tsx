"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowUpRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dashboardNavItems,
  isExternalNavLink,
  resourceNavLinks,
} from "@/lib/navigation";
import { LogstackLogo } from "@/components/brand/logstack-logo";
import { SidebarUsage } from "./sidebar-usage";

export { dashboardNavItems as navItems, resourceNavLinks as navLinks } from "@/lib/navigation";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <aside
      className={cn(
        "hidden w-64 flex-col border-r border-border bg-card md:flex",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b border-border px-6">
        <LogstackLogo
          href="/overview"
          size={28}
          className="text-xl text-foreground"
          labelClassName="text-foreground"
        />
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {dashboardNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "border border-primary/20 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/5 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin ? (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              pathname.startsWith("/admin")
                ? "border border-primary/20 bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent/5 hover:text-foreground",
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        ) : null}

        <div className="my-3 border-t border-border" />

        {resourceNavLinks.map((item) => {
          const isActive =
            !isExternalNavLink(item.href) && pathname.startsWith(item.href);
          const Icon = item.icon;
          const isExternal = item.external ?? isExternalNavLink(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "border border-primary/20 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/5 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {isExternal ? (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <SidebarUsage />
      </div>
    </aside>
  );
}