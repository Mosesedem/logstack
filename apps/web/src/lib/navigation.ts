import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CreditCard,
  FileText,
  FlaskConical,
  FolderOpen,
  LayoutDashboard,
  Phone,
  Settings,
  Ship,
  Tag,
  Users,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

export interface NavAction {
  href: string;
  label: string;
}

export interface SimpleLink {
  href: string;
  label: string;
  external?: boolean;
}

/** Authenticated dashboard routes shown in the sidebar and mobile drawer. */
export const dashboardNavItems: NavLink[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/demo", label: "SDK Demo", icon: FlaskConical },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/team", label: "Team", icon: Users },
];

/** Public resource links shown in the dashboard sidebar and marketing menus. */
export const resourceNavLinks: NavLink[] = [
  { href: "/docs", label: "Documentation", icon: FileText },
  { href: "/pricing", label: "Pricing", icon: Tag },
  { href: "/support", label: "Support", icon: Phone },
  { href: "/changelog", label: "Changelog", icon: Ship },
  { href: "/blog", label: "Blog", icon: FileText },
  {
    href: "https://github.com/mosesedem/logstack",
    label: "GitHub",
    icon: FolderOpen,
    external: true,
  },
];

/** Primary links for the public marketing header (desktop + mobile). */
export const marketingNavItems: NavLink[] = resourceNavLinks.filter(
  (item) => !item.external,
);

export const authNavActions = {
  signIn: { href: "/login", label: "Sign In" },
  signUp: { href: "/signup", label: "Get Started" },
} as const satisfies Record<string, NavAction>;

export function isExternalNavLink(href: string): boolean {
  return href.startsWith("http");
}

/** Landing-page footer link groups. */
export const productFooterLinks: SimpleLink[] = [
  { href: "/#features", label: "Features" },
  { href: "/integrations", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];

export const resourcesFooterLinks: SimpleLink[] = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs#api", label: "API Reference" },
  {
    href: "https://github.com/mosesedem/logstack/discussions",
    label: "Community",
    external: true,
  },
  {
    href: "https://github.com/mosesedem/logstack",
    label: "GitHub",
    external: true,
  },
];

export const companyFooterLinks: SimpleLink[] = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];