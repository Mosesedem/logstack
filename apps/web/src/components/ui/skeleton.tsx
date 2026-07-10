import { cn } from "@/lib/utils";

/**
 * Base skeleton block. Prefer content-shaped skeletons over centered spinners
 * for full-page and list loads.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      aria-hidden
      {...props}
    />
  );
}

export { Skeleton };
