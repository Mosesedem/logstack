import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogstackLogoProps {
  /** Destination when the logo is a link. Pass `null` for a non-link mark. */
  href?: string | null;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  /** Show the "Logstack" wordmark next to the mark. Default true. */
  showLabel?: boolean;
  /** Pixel size of the mark (width & height). Default 32. */
  size?: number;
  /**
   * `default` — solid brand tile (`/icon.png`, matches PWA / home-screen).
   * `clear` — transparent white mark (`/icon_clear.png`) for dark/colored surfaces.
   */
  variant?: "default" | "clear";
  onClick?: () => void;
  priority?: boolean;
}

/**
 * Canonical Logstack brand mark + optional wordmark.
 *
 * Brand assets live in repo-root `assets/` and are synced to `public/` via
 * `./scripts/sync_brand_icons.sh`. Prefer this component over ad-hoc images.
 */
export function LogstackLogo({
  href = "/",
  className,
  iconClassName,
  labelClassName,
  showLabel = true,
  size = 32,
  variant = "default",
  onClick,
  priority = false,
}: LogstackLogoProps) {
  const src = variant === "clear" ? "/icon_clear.png" : "/icon.png";
  const radius = Math.round(size * 0.22);
  const isClear = variant === "clear";

  const mark = (
    <Image
      src={src}
      alt="Logstack"
      width={size}
      height={size}
      priority={priority}
      className={cn(
        "shrink-0",
        isClear ? "object-contain" : "object-cover",
        iconClassName,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: isClear ? 0 : radius,
      }}
    />
  );

  const content = (
    <>
      {mark}
      {showLabel && (
        <span className={cn("truncate font-bold tracking-tight", labelClassName)}>
          Logstack
        </span>
      )}
    </>
  );

  const layoutClass = cn(
    "inline-flex min-w-0 items-center gap-2 transition-opacity",
    href != null && "hover:opacity-80",
    className,
  );

  if (href == null) {
    return (
      <div className={layoutClass} onClick={onClick}>
        {content}
      </div>
    );
  }

  return (
    <Link href={href} onClick={onClick} className={layoutClass}>
      {content}
    </Link>
  );
}
