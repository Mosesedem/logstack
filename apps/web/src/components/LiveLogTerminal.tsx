"use client";

import { useEffect, useRef, useState } from "react";

type LogLevel = "info" | "warn" | "error" | "ok";

const LEVEL_STYLES: Record<LogLevel, { label: string; className: string }> = {
  info: {
    label: "INFO",
    className: "text-blue-400 border-blue-400/25 bg-blue-400/10",
  },
  ok: {
    label: "OK",
    className: "text-green-400 border-green-400/25 bg-green-400/10",
  },
  warn: {
    label: "WARN",
    className: "text-amber-400 border-amber-400/25 bg-amber-400/10",
  },
  error: {
    label: "ERROR",
    className: "text-red-400 border-red-400/25 bg-red-400/10",
  },
};

const LOG_SCRIPT: {
  level: LogLevel;
  service: string;
  message: string;
  ms: string;
}[] = [
  {
    level: "info",
    service: "api-gateway",
    message: "POST /v1/checkout → 201",
    ms: "12ms",
  },
  {
    level: "ok",
    service: "billing",
    message: "subscription.created plan=pro_monthly",
    ms: "44ms",
  },
  {
    level: "info",
    service: "auth",
    message: "session refreshed user_id=usr_82f1",
    ms: "3ms",
  },
  {
    level: "warn",
    service: "queue-worker",
    message: "retry 2/5 job=email.send",
    ms: "210ms",
  },
  {
    level: "info",
    service: "cdn-edge",
    message: "cache MISS /assets/app.js",
    ms: "58ms",
  },
  {
    level: "error",
    service: "payments",
    message: "card_declined code=insufficient_funds",
    ms: "91ms",
  },
  {
    level: "ok",
    service: "payments",
    message: "retry succeeded via backup_method",
    ms: "120ms",
  },
  {
    level: "info",
    service: "search",
    message: "query indexed docs=1,204",
    ms: "6ms",
  },
  {
    level: "ok",
    service: "deploy",
    message: "rollout complete region=us-east-1",
    ms: "—",
  },
];

export function LiveLogTerminal() {
  const [visible, setVisible] = useState(3);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(LOG_SCRIPT.length);
      return;
    }
    const id = setInterval(() => {
      setVisible((v) => (v >= LOG_SCRIPT.length ? 3 : v + 1));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visible]);

  const rows = LOG_SCRIPT.slice(0, visible);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/70 shadow-2xl backdrop-blur">
      {/* Window chrome */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-green-400/70" />
        </div>
        <div className="min-w-0 truncate font-mono text-[10px] text-muted-foreground sm:text-xs">
          live · production.stream
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-green-400 sm:text-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-green-400" />
          </span>
          streaming
        </div>
      </div>

      {/* Log rows */}
      <div
        ref={scrollRef}
        className="h-[260px] overflow-hidden p-2 font-mono text-[12px] sm:h-[320px] sm:p-3 sm:text-[13px]"
      >
        {rows.map((row, i) => {
          const style = LEVEL_STYLES[row.level];
          return (
            <div
              key={`${row.service}-${i}`}
              className="animate-log-in flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-accent/50 sm:gap-3 sm:px-2"
            >
              <span className="hidden shrink-0 text-muted-foreground md:inline">
                {new Date(
                  Date.now() - (rows.length - i) * 1400,
                ).toLocaleTimeString("en-US", {
                  hour12: false,
                })}
              </span>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wide ${style.className}`}
              >
                {style.label}
              </span>
              <span className="hidden shrink-0 text-brand sm:inline">
                {row.service}
              </span>
              <span className="min-w-0 truncate text-foreground/80">
                {row.message}
              </span>
              <span className="ml-auto hidden shrink-0 text-muted-foreground sm:inline">
                {row.ms}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
