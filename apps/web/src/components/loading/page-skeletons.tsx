import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Page title + subtitle + optional action slot. */
export function PageHeaderSkeleton({
  className,
  withAction = true,
}: {
  className?: string;
  withAction?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {withAction ? <Skeleton className="h-9 w-28 rounded-md" /> : null}
    </div>
  );
}

/** Overview-style metric cards. */
export function StatsGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-6 space-y-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Single log row matching LogCard layout. */
export function LogRowSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 border-l-2 border-l-muted">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="ml-auto h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-full max-w-[90%]" />
          <Skeleton className="h-4 w-[55%]" />
        </div>
      </div>
    </div>
  );
}

export function LogListSkeleton({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-label="Loading logs"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <LogRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Full logs page chrome: header, filters, rows. */
export function LogsPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading logs page">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <LogListSkeleton rows={8} />
    </div>
  );
}

export function OverviewPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading overview">
      <PageHeaderSkeleton />
      <StatsGridSkeleton count={4} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-[66%]" />
                  <Skeleton className="h-3 w-[50%]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Project / generic card grid. */
export function CardGridSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectsPageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading projects">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <CardGridSkeleton count={3} />
    </div>
  );
}

/** Alert rule cards. */
export function AlertListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading alerts">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AlertsPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading alerts page">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <AlertListSkeleton count={3} />
    </div>
  );
}

/** Table-like rows (team, audit, invoices). */
export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl border bg-card overflow-hidden", className)}
      role="status"
      aria-label="Loading table"
    >
      <div className="border-b bg-muted/30 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 flex items-center gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  "h-4",
                  c === 0 ? "w-32" : c === columns - 1 ? "w-16 ml-auto" : "w-24",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BillingPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading billing">
      <PageHeaderSkeleton withAction={false} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[80%]" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6" role="status" aria-label="Loading settings">
      <PageHeaderSkeleton withAction={false} />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64 max-w-full" />
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function TeamPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading team">
      <PageHeaderSkeleton />
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <TableSkeleton rows={5} columns={4} className="border-0 shadow-none" />
      </div>
    </div>
  );
}

export function AuditPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading audit log">
      <PageHeaderSkeleton withAction={false} />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

/** Compact block for sidebar widgets. */
export function SidebarWidgetSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 p-3", className)}>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
