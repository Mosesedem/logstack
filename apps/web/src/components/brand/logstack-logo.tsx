import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogstackLogoProps {
  href?: string;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  onClick?: () => void;
}

export function LogstackLogo({
  href = "/",
  className,
  iconClassName,
  labelClassName,
  onClick,
}: LogstackLogoProps) {
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <svg
          className={cn("h-7 w-7 text-primary", iconClassName)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
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
      <span className={cn("truncate", labelClassName)}>Logstack</span>
    </>
  );

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-2 font-bold tracking-tight transition-opacity hover:opacity-80",
        className,
      )}
    >
      {content}
    </Link>
  );
}