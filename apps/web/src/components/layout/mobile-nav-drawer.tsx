"use client";

import { useSession } from "next-auth/react";
import { LogOut, Shield, Smartphone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogstackLogo } from "@/components/brand/logstack-logo";
import { ProjectSwitcher } from "./project-switcher";
import { SidebarUsage } from "./sidebar-usage";
import { SlideMenuDrawer } from "./slide-menu-drawer";
import { NavLinkList } from "./nav-link-list";
import {
  dashboardNavItems,
  resourceNavLinks,
  type NavLink,
} from "@/lib/navigation";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  onLinkMobile: () => void;
  onRequestSignOut: () => void;
}

export function MobileNavDrawer({
  open,
  onClose,
  onLinkMobile,
  onRequestSignOut,
}: MobileNavDrawerProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const dashboardItems: NavLink[] = isAdmin
    ? [...dashboardNavItems, { href: "/admin", label: "Admin", icon: Shield }]
    : dashboardNavItems;

  return (
    <SlideMenuDrawer
      open={open}
      onClose={onClose}
      header={
        <LogstackLogo
          href="/overview"
          onClick={onClose}
          className="text-lg text-foreground"
          labelClassName="text-foreground"
        />
      }
      footer={
        <>
          <SidebarUsage />

          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">{session?.user?.email}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => {
                onClose();
                onLinkMobile();
              }}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Link App
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-destructive hover:text-destructive"
              onClick={() => {
                onClose();
                onRequestSignOut();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </>
      }
    >
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Project
        </p>
        <ProjectSwitcher className="w-full" />
      </div>

      <nav className="space-y-1">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dashboard
        </p>
        <NavLinkList
          items={dashboardItems}
          onNavigate={onClose}
          activePrefixMatch
        />
      </nav>

      <nav className="mt-6 space-y-1 border-t border-border pt-4">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Resources
        </p>
        <NavLinkList
          items={resourceNavLinks}
          onNavigate={onClose}
          activePrefixMatch={false}
        />
      </nav>
    </SlideMenuDrawer>
  );
}