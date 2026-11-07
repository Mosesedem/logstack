"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Copy,
  ChevronDown,
  ChevronRight,
  Check,
  Search,
  Wifi,
  Send,
  X,
} from "lucide-react";
import { LevelBadge } from "@/components/logs/level-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Log } from "@/types";

const INITIAL_LOGS: Log[] = [
  {
    id: 1042,
    projectId: "proj_prod",
    level: "info",
    source: "api-gateway",
    message: "POST /v1/checkout → 201 Created",
    createdAt: new Date(Date.now() - 32000).toISOString(),
    metadata: {
      route: "/v1/checkout",
      status: 201,
      durationMs: 14,
      ip: "198.51.100.42",
      userAgent: "logstack-js/v1.0.3",
      region: "us-east-1",
    },
  },
  {
    id: 1043,
    projectId: "proj_prod",
    level: "info",
    source: "billing",
    message: "subscription.created plan=pro_monthly customer=cus_821a",
    createdAt: new Date(Date.now() - 25000).toISOString(),
    metadata: {
      provider: "polar",
      plan: "pro_monthly",
      amountCents: 2900,
      currency: "USD",
      subscriptionId: "sub_92k4a8f",
    },
  },
  {
    id: 1044,
    projectId: "proj_prod",
    level: "warn",
    source: "queue-worker",
    message: 'retry 2/5 job=email.welcome err="connection_timeout"',
    createdAt: new Date(Date.now() - 19000).toISOString(),
    metadata: {
      jobId: "job_welcome_481",
      attempts: 2,
      maxAttempts: 5,
      backoffSec: 4,
      targetEmail: "alex@acme.dev",
    },
  },
  {
    id: 1045,
    projectId: "proj_prod",
    level: "error",
    source: "payments",
    message: "card_declined code=insufficient_funds customer=cus_901b",
    createdAt: new Date(Date.now() - 12000).toISOString(),
    metadata: {
      errorCode: "insufficient_funds",
      declineCode: "card_declined",
      cardBrand: "visa",
      last4: "4242",
      attempt: 1,
    },
  },
  {
    id: 1046,
    projectId: "proj_prod",
    level: "info",
    source: "console",
    message: "console.log: Auth session refreshed user_id=usr_82f1",
    createdAt: new Date(Date.now() - 6000).toISOString(),
    metadata: {
      userId: "usr_82f1",
      tokenType: "jwt",
      device: "macOS 15.1 Safari",
    },
  },
];

const STREAMING_POOL: Omit<Log, "id" | "createdAt">[] = [
  {
    projectId: "proj_prod",
    level: "info",
    source: "api-gateway",
    message: "GET /v1/projects/proj_prod/logs?limit=50 → 200 OK",
    metadata: {
      route: "/v1/projects/proj_prod/logs",
      status: 200,
      durationMs: 8,
      source: "dashboard-live",
    },
  },
  {
    projectId: "proj_prod",
    level: "info",
    source: "auth",
    message: "token.verified user_id=usr_912a role=developer",
    metadata: {
      userId: "usr_912a",
      role: "developer",
      algorithm: "Ed25519",
    },
  },
  {
    projectId: "proj_prod",
    level: "warn",
    source: "postgres",
    message: 'slow_query duration=420ms query="SELECT count(*) FROM logs"',
    metadata: {
      durationMs: 420,
      thresholdMs: 250,
      rowsExamined: 1420800,
    },
  },
  {
    projectId: "proj_prod",
    level: "info",
    source: "cdn-edge",
    message: "cache MISS /assets/dashboard.js [pop=iad1]",
    metadata: {
      path: "/assets/dashboard.js",
      cacheStatus: "MISS",
      edgePoP: "iad1-c1",
    },
  },
  {
    projectId: "proj_prod",
    level: "error",
    source: "payments",
    message:
      "webhook_delivery_failed endpoint=https://api.acme.dev/events code=504",
    metadata: {
      endpoint: "https://api.acme.dev/events",
      httpStatus: 504,
      retryCount: 3,
    },
  },
  {
    projectId: "proj_prod",
    level: "info",
    source: "console",
    message: "console.info: Background worker pool resized workers=12",
    metadata: {
      activeWorkers: 12,
      queueDepth: 4,
    },
  },
];

export function LiveLogTerminal() {
  const [logs, setLogs] = useState<Log[]>(INITIAL_LOGS);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const nextIdRef = useRef(1047);
  const poolIndexRef = useRef(0);

  // When a user clicks to expand a log, pause other stream actions so the user is not interrupted!
  const isDetailsOpen = expandedId !== null;

  useEffect(() => {
    // If details are open, do not interrupt the user with new incoming logs
    if (isDetailsOpen) return;

    const interval = setInterval(() => {
      const template =
        STREAMING_POOL[poolIndexRef.current % STREAMING_POOL.length];
      poolIndexRef.current += 1;

      const newLog: Log = {
        ...template,
        id: nextIdRef.current++,
        createdAt: new Date().toISOString(),
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 19)]);
    }, 2800);

    return () => clearInterval(interval);
  }, [isDetailsOpen]);

  const handleSendTestLog = () => {
    const testLog: Log = {
      id: nextIdRef.current++,
      projectId: "proj_prod",
      level: "info",
      source: "sdk",
      message: "Test log emitted via logstack.info()",
      createdAt: new Date().toISOString(),
      metadata: {
        dispatchedFrom: "web-landing-preview",
        timestamp: new Date().toISOString(),
        environment: "production",
      },
    };
    setLogs((prev) => [testLog, ...prev.slice(0, 19)]);
  };

  const copyLog = (log: Log, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copyMessage = (message: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(message);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) {
        return false;
      }
      if (sourceFilter !== "all") {
        const isConsole = (log.source || "").toLowerCase() === "console";
        if (sourceFilter === "console" && !isConsole) return false;
        if (sourceFilter === "sdk" && isConsole) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(q);
        const matchesSrc = (log.source || "").toLowerCase().includes(q);
        const matchesMeta = log.metadata
          ? JSON.stringify(log.metadata).toLowerCase().includes(q)
          : false;
        return matchesMsg || matchesSrc || matchesMeta;
      }
      return true;
    });
  }, [logs, levelFilter, sourceFilter, searchQuery]);

  const hasActiveFilters =
    levelFilter !== "all" ||
    sourceFilter !== "all" ||
    searchQuery.trim().length > 0;

  return (
    <div className="rounded-xl border border-border bg-card/40 shadow-xl overflow-hidden">
      {/* Dashboard Top Header (mobile-first compact single-row) */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/60 px-3 py-2.5 sm:px-6 sm:py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-foreground sm:text-lg">
            Logs
          </h3>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs font-medium text-foreground truncate max-w-[90px] sm:max-w-none">
            production
          </span>
          <span className="hidden rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-block">
            captureConsole on
          </span>
          <div
            className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground shrink-0 ml-1"
            title="Live WebSocket stream connected"
          >
            <Wifi className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500 animate-pulse" />
            <span>Live</span>
          </div>
        </div>

        {/* <Button
          variant="outline"
          size="sm"
          onClick={handleSendTestLog}
          className="h-7 sm:h-8 text-[11px] sm:text-xs font-mono shrink-0 px-2.5 sm:px-3"
        >
          <Send className="mr-1.5 h-3 w-3 text-muted-foreground" />
          Send test log
        </Button> */}
      </div>

      {/* Filter Controls Bar (mobile-first 2-column grid for selects) */}
      <div className="border-b border-border bg-card/20 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative w-full flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search logs or metadata..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 sm:h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
            <Select
              value={levelFilter}
              onValueChange={(val) => setLevelFilter(val)}
            >
              <SelectTrigger className="w-full sm:w-28 h-8 sm:h-9 text-xs">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sourceFilter}
              onValueChange={(val) => setSourceFilter(val)}
            >
              <SelectTrigger className="w-full sm:w-32 h-8 sm:h-9 text-xs">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="console">console.*</SelectItem>
                <SelectItem value="sdk">sdk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLevelFilter("all");
                setSourceFilter("all");
                setSearchQuery("");
              }}
              className="h-8 sm:h-9 text-xs text-muted-foreground self-end sm:self-auto"
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Interruption Pause Indicator (when viewing details) */}
      {/* {isDetailsOpen && (
        <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs text-amber-400">
          <span>Stream paused while viewing log details.</span>
          <button
            type="button"
            onClick={() => setExpandedId(null)}
            className="font-medium underline hover:text-amber-300 ml-2 shrink-0"
          >
            Resume stream
          </button>
        </div>
      )} */}

      {/* Log Cards List (responsive on mobile) */}
      <div className="h-[320px] sm:h-[400px] overflow-y-auto p-2.5 sm:p-4 space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center py-10 text-center text-muted-foreground text-xs sm:text-sm">
            <div>
              No logs match current filters.
              <br />
              <span className="text-[11px] text-muted-foreground/80">
                Clear filters or tap &quot;Send test log&quot; to emit a sample
                event.
              </span>
            </div>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            const isConsole = (log.source || "").toLowerCase() === "console";
            const isCopied = copiedId === log.id;

            return (
              <Card
                key={log.id}
                className="cursor-pointer transition-all hover:bg-muted/50 border-l-2"
                style={{ borderLeftColor: isConsole ? "#a371f7" : undefined }}
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 text-muted-foreground"
                      aria-label={
                        isExpanded
                          ? "Collapse log details"
                          : "Expand log details"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : log.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <LevelBadge
                      level={log.level}
                      className="text-[10px] px-1.5 py-0.5"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-xs sm:text-sm break-words pr-1 text-foreground leading-snug">
                          {log.message}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={(e) => copyMessage(log.message, e)}
                            title="Copy message"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={(e) => copyLog(log, e)}
                            title="Copy full log as JSON"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span
                          suppressHydrationWarning
                          className="inline-flex items-center gap-1"
                          title={new Date(log.createdAt).toISOString()}
                        >
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(log.createdAt).toLocaleTimeString(
                              "en-US",
                              {
                                hour12: false,
                              },
                            )}
                          </span>
                        </span>

                        {log.source && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium tracking-wide uppercase ${
                              isConsole
                                ? "bg-purple-500/10 text-purple-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                            title="Log source"
                          >
                            {isConsole ? "console.*" : log.source}
                          </span>
                        )}

                        <span className="font-mono text-[10px] opacity-50">
                          #{log.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Metadata (replicates real LogCard expanded view) */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <div className="mb-1 font-medium text-muted-foreground text-[11px]">
                            Metadata
                          </div>
                          <pre className="max-h-56 overflow-x-auto touch-pan-x rounded bg-muted/70 p-2.5 text-[10px] sm:text-[11px] leading-snug border border-border font-mono">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="pt-1 text-[10px] text-muted-foreground flex items-center justify-between">
                        <span className="truncate pr-2">
                          Full time: {new Date(log.createdAt).toISOString()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => copyLog(log, e)}
                          className="underline hover:text-foreground font-mono shrink-0"
                        >
                          {isCopied ? "Copied JSON" : "Copy JSON"}
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dashboard Bottom Bar */}
      <div className="border-t border-border bg-card/60 px-3 py-2 text-center text-[11px] sm:text-xs text-muted-foreground sm:px-6">
        {/* <span>
          Live stream for <strong>production</strong>. Tap any card to inspect
          metadata.
        </span> */}
      </div>
    </div>
  );
}
