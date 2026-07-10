"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  LayoutDashboard,
  Shield,
  FolderGit2,
  CreditCard,
  Tags,
  Receipt,
  Building2,
  Bell,
  Mail,
  BarChart3,
  ScrollText,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderGit2 },
  { href: "/admin/plans", label: "Pricing plans", icon: Tags },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/alerts", label: "Alerts", icon: Bell },
  { href: "/admin/invites", label: "Invites", icon: Mail },
  { href: "/admin/usage", label: "Usage", icon: BarChart3 },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-xl font-bold text-primary"
        >
          <Shield className="h-6 w-6" />
          Logstack Admin
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <Link
          href="/overview"
          className="flex items-center justify-center gap-2 rounded-lg border p-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Back to App
        </Link>
      </div>
    </aside>
  );
}
