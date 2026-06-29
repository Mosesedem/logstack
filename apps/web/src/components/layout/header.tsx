"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Menu, Smartphone } from "lucide-react";
import { LogstackLogo } from "@/components/brand/logstack-logo";
import { ProjectSwitcher } from "./project-switcher";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkMobileDialog } from "@/components/auth/link-mobile-dialog";
import { authNavActions } from "@/lib/navigation";

export function Header() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [linkMobileOpen, setLinkMobileOpen] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem("currentProjectId");
    signOut({ callbackUrl: authNavActions.signIn.href });
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:bg-background/95 md:px-6 md:backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="md:hidden">
            <LogstackLogo
              href="/overview"
              className="text-lg text-foreground"
              labelClassName="text-foreground"
            />
          </div>

          <div className="hidden md:block">
            <ProjectSwitcher />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Account menu"
              >
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="truncate px-2 py-1.5 text-sm text-muted-foreground">
                {session?.user?.email}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => setLinkMobileOpen(true)}
              >
                <Smartphone className="h-4 w-4" />
                Link Mobile App
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                onSelect={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:flex"
              >
                <User className="h-4 w-4" />
                <span className="max-w-[160px] truncate">
                  {session?.user?.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => setLinkMobileOpen(true)}
              >
                <Smartphone className="h-4 w-4" />
                Link Mobile App
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                onSelect={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MobileNavDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onLinkMobile={() => setLinkMobileOpen(true)}
      />

      <LinkMobileDialog open={linkMobileOpen} onOpenChange={setLinkMobileOpen} />
    </>
  );
}