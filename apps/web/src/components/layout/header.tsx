"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectSwitcher } from "./project-switcher";
import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, X, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./sidebar";

export function Header() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
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

        <div className="hidden md:block">
          <ProjectSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{session?.user?.email}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            localStorage.removeItem("currentProjectId");
            signOut({ callbackUrl: "/login" });
          }}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/10"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden animate-in fade-in duration-200">
          <div className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-background border-r border-border p-6 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-8">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-400"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mb-6">
              <ProjectSwitcher />
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-zinc-400 hover:text-white hover:bg-white/5",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-center gap-3 text-sm text-zinc-400 mb-4 p-3 rounded-lg bg-white/5">
                <User className="h-4 w-4" />
                <span className="truncate">{session?.user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
