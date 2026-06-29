"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SlideMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  backdropClassName?: string;
  className?: string;
}

export function SlideMenuDrawer({
  open,
  onClose,
  header,
  children,
  footer,
  panelClassName,
  headerClassName,
  footerClassName,
  backdropClassName,
  className,
}: SlideMenuDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[100] md:hidden", className)}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close navigation menu"
        className={cn("absolute inset-0 bg-black/70", backdropClassName)}
        onClick={onClose}
      />

      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col border-r border-border bg-card shadow-2xl",
          panelClassName,
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center justify-between border-b border-border px-4",
            headerClassName,
          )}
        >
          <div className="min-w-0 flex-1">{header}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {footer ? (
          <div
            className={cn(
              "shrink-0 space-y-3 border-t border-border p-4",
              footerClassName ?? "bg-card",
            )}
          >
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}