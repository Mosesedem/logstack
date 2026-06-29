"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogstackLogo } from "@/components/brand/logstack-logo";
import { SlideMenuDrawer } from "@/components/layout/slide-menu-drawer";
import { NavLinkList } from "@/components/layout/nav-link-list";
import { authNavActions, marketingNavItems } from "@/lib/navigation";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950 md:bg-black/90 md:backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <LogstackLogo
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="text-xl text-white"
            labelClassName="text-white"
          />

          <div className="hidden items-center gap-8 md:flex">
            {marketingNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-zinc-300 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href={authNavActions.signIn.href}
              className="text-sm font-medium text-zinc-300 transition-colors hover:text-white"
            >
              {authNavActions.signIn.label}
            </Link>
            <Link
              href={authNavActions.signUp.href}
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black transition-all hover:scale-105 hover:bg-zinc-200"
            >
              {authNavActions.signUp.label}
            </Link>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      <SlideMenuDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        panelClassName="border-white/10 bg-zinc-950"
        headerClassName="border-white/10"
        footerClassName="border-white/10 bg-zinc-950"
        header={
          <LogstackLogo
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="text-lg text-white"
            labelClassName="text-white"
          />
        }
        footer={
          <div className="grid gap-2">
            <Link
              href={authNavActions.signIn.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-11 items-center justify-center rounded-lg border border-white/10 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {authNavActions.signIn.label}
            </Link>
            <Link
              href={authNavActions.signUp.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-11 items-center justify-center rounded-full bg-white text-sm font-bold text-black transition-colors hover:bg-zinc-200"
            >
              {authNavActions.signUp.label}
            </Link>
          </div>
        }
      >
        <nav className="space-y-1">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Explore
          </p>
          <NavLinkList
            items={marketingNavItems}
            onNavigate={() => setMobileMenuOpen(false)}
            activePrefixMatch
            showExternalIcon={false}
            inactiveClassName="text-zinc-300 hover:bg-white/5 hover:text-white"
            activeClassName="border-white/10 bg-white/10 text-white"
          />
        </nav>
      </SlideMenuDrawer>
    </>
  );
}