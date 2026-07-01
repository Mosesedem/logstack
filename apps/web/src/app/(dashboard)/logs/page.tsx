"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react";

import { useProject } from "@/hooks/use-project";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { LogList, LogFilters } from "@/components/logs";
import type { Log, LogLevel } from "@/types";

const PAGE_SIZE = 50;
// Hard cap on rendered rows so the realtime + paginated merge can't grow the DOM
// unbounded during a high-volume stream.
const MAX_RENDERED = 500;

interface LogsPage {
  logs: Log[];
  total: number;
  offset: number;
  hasMore: boolean;
}

interface FilterState {
  level: string;
  search: string;
}

function matchesFilters(log: Log, filters: FilterState): boolean {
  if (filters.level && log.level !== (filters.level as LogLevel)) {
    return false;
  }
  if (
    filters.search &&
    !log.message.toLowerCase().includes(filters.search.toLowerCase())
  ) {
    return false;
  }
  return true;
}

export default function LogsPage() {
  const { currentProject } = useProject();
  const router = useRouter();
  const projectId = currentProject?.id;
  const [filters, setFilters] = useState<FilterState>({ level: "", search: "" });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["project-logs", projectId, filters.level, filters.search],
    enabled: !!projectId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageParam),
      });
      if (filters.level) params.set("level", filters.level);
      if (filters.search) params.set("search", filters.search);
      return api.get<LogsPage>(
        `/projects/${projectId}/logs?${params.toString()}`,
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + PAGE_SIZE : undefined,
  });

  // Live stream for the selected project.
  const { logs: realtimeLogs, isConnected } = useWebSocket({ projectId });

  // Merge realtime + paginated logs, dedupe by id (realtime wins), apply the
  // active filters to realtime entries too, sort newest-first, and cap.
  const logs = useMemo(() => {
    const paginated = data?.pages.flatMap((p) => p.logs) ?? [];
    const byId = new Map<number, Log>();
    for (const log of realtimeLogs) {
      if (matchesFilters(log, filters)) byId.set(log.id, log);
    }
    for (const log of paginated) {
      if (!byId.has(log.id)) byId.set(log.id, log);
    }
    return Array.from(byId.values())
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, MAX_RENDERED);
  }, [data, realtimeLogs, filters]);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-muted-foreground">
            Select or create a project to view its logs
          </p>
        </div>
        <Button onClick={() => router.push("/create")}>Create Project</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-muted-foreground">{currentProject.name}</p>
        </div>
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          title={isConnected ? "Live stream connected" : "Reconnecting…"}
        >
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          )}
          {isConnected ? "Live" : "Offline"}
        </div>
      </div>

      <LogFilters filters={filters} onFiltersChange={setFilters} />

      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Failed to load logs</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {error instanceof Error
                ? error.message
                : "Could not connect to the API. Make sure the server is running."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </div>
      ) : (
        <LogList
          logs={logs}
          onLoadMore={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          hasMore={!!hasNextPage}
          isLoading={isFetching}
        />
      )}
    </div>
  );
}
