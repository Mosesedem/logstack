"use client";

import { useSession } from "next-auth/react";
import { Shield } from "lucide-react";
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
        <SidebarUsage
          onLinkMobile={() => {
            onClose();
            onLinkMobile();
          }}
          onRequestSignOut={() => {
            onClose();
            onRequestSignOut();
          }}
        />
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