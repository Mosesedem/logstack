"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isExternalNavLink,
  type NavLink,
} from "@/lib/navigation";

interface NavLinkListProps {
  items: NavLink[];
  onNavigate?: () => void;
  activePrefixMatch?: boolean;
  showExternalIcon?: boolean;
  itemClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

export function NavLinkList({
  items,
  onNavigate,
  activePrefixMatch = true,
  showExternalIcon = true,
  itemClassName,
  activeClassName,
  inactiveClassName,
}: NavLinkListProps) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const isExternal = item.external ?? isExternalNavLink(item.href);
        const isActive =
          activePrefixMatch &&
          !isExternal &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
              isActive
                ? cn(
                    "border border-primary/20 bg-primary/10 text-primary",
                    activeClassName,
                  )
                : cn(
                    "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    inactiveClassName,
                  ),
              itemClassName,
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
            {showExternalIcon && isExternal ? (
              <ArrowUpRight className="ml-auto h-3 w-3 text-muted-foreground" />
            ) : null}
          </Link>
        );
      })}
    </>
  );
}