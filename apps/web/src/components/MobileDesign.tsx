"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Battery,
  Bell,
  Check,
  Fingerprint,
  Lock,
  LockOpen,
  Search,
  Settings,
  Signal,
  ChevronsUpDown,
  Wifi,
} from "lucide-react";
import { LogstackLogo } from "@/components/brand/logstack-logo";

/**
 * Interactive mockup of the Logstack Flutter companion app.
 * Native pixel sizing prevents WebKit scale() blurriness on mobile.
 */

type ScreenId = "logs" | "push" | "security";

interface MockLog {
  id: number;
  level: "CRITICAL" | "ERROR" | "WARN" | "INFO" | "DEBUG";
  message: string;
  source: string;
  time: string;
}

const LOGS: MockLog[] = [
  {
    id: 1,
    level: "CRITICAL",
    message: "DB Connection Timeout: pool exhausted (max 100)",
    source: "api",
    time: "2m ago",
  },
  {
    id: 2,
    level: "ERROR",
    message: "Payment webhook failed: polar signature mismatch",
    source: "billing",
    time: "5m ago",
  },
  {
    id: 3,
    level: "WARN",
    message: "Rate limit approaching: 92% of quota consumed",
    source: "gateway",
    time: "14m ago",
  },
  {
    id: 4,
    level: "INFO",
    message: "Worker process started: queue=ingest pid=4021",
    source: "worker",
    time: "20m ago",
  },
  {
    id: 5,
    level: "DEBUG",
    message: "Cache warm complete: 1,420 keys indexed",
    source: "cache",
    time: "1h ago",
  },
];

const LEVEL_STYLES = {
  CRITICAL: {
    fg: "text-[#ef4444]",
    bg: "bg-[#ef4444]/20",
    bar: "bg-[#ef4444]",
  },
  ERROR: {
    fg: "text-[#f87171]",
    bg: "bg-[#ef4444]/15",
    bar: "bg-[#ef4444]",
  },
  WARN: {
    fg: "text-[#facc15]",
    bg: "bg-[#eab308]/15",
    bar: "bg-[#eab308]",
  },
  INFO: {
    fg: "text-[#38bdf8]",
    bg: "bg-[#38bdf8]/15",
    bar: "bg-[#38bdf8]",
  },
  DEBUG: {
    fg: "text-[#c084fc]",
    bg: "bg-[#c084fc]/15",
    bar: "bg-[#c084fc]",
  },
} as const;

const FILTERS = ["All", "Critical", "Error", "Warn", "Info"] as const;
type FilterType = (typeof FILTERS)[number];

const FILTER_DOT: Record<FilterType, string | null> = {
  All: null,
  Critical: "#ef4444",
  Error: "#f87171",
  Warn: "#facc15",
  Info: "#38bdf8",
};

function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-1 text-[11px] font-semibold text-zinc-300">
      <span className="tabular-nums">9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3 w-3" strokeWidth={2.5} />
        <Wifi className="h-3 w-3" strokeWidth={2.5} />
        <Battery className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-zinc-950 transition-opacity hover:opacity-90 active:scale-[0.99]"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function PushScreen({ onSwitchToLogs }: { onSwitchToLogs: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between px-5 pb-8 pt-4">
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="relative flex shrink-0 items-center justify-center">
          <LogstackLogo href={null} showLabel={false} size={56} priority />
        </div>
        <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
          <Bell className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-white">
          Real-time incident alerts
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Get push alerts the instant error rates spike or critical thresholds
          are breached in production.
        </p>

        <div className="mt-5 w-full space-y-2 rounded-xl border border-white/10 bg-zinc-900/80 p-3 text-left">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-white">Threshold trigger</span>
            <span className="text-emerald-400 font-mono">active</span>
          </div>
          <p className="text-[10px] font-mono text-zinc-400">
            &gt; 5 errors/min in api-gateway
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <PrimaryButton
          icon={<Bell className="h-3.5 w-3.5" />}
          onClick={onSwitchToLogs}
        >
          View live stream
        </PrimaryButton>
        <p className="text-center text-[10px] text-zinc-500">
          Escalations routed to your mobile device
        </p>
      </div>
    </div>
  );
}

function SecurityScreen({ onSwitchToLogs }: { onSwitchToLogs: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between px-5 pb-8 pt-3">
      <div>
        <div className="flex flex-col items-center text-center">
          <div className="relative flex shrink-0 items-center justify-center">
            <LogstackLogo href={null} showLabel={false} size={48} priority />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-white">
            Biometric telemetry lock
          </h3>
          <p className="mt-1 text-[11px] text-zinc-400">
            Keep sensitive production metadata protected
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">
                    Face ID & PIN
                  </span>
                  <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-400">
                    Active
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-300">
                  Secures cached logs on device exit
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 opacity-60">
            <div className="flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                <LockOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-zinc-300">
                  Open Session
                </span>
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  Unlocked until manual signout
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <Fingerprint className="h-3.5 w-3.5 text-blue-400" />
          <span>Biometric hardware enclave enabled</span>
        </div>
      </div>

      <PrimaryButton onClick={onSwitchToLogs}>
        Return to log stream
      </PrimaryButton>
    </div>
  );
}

function LogCard({ log }: { log: MockLog }) {
  const style = LEVEL_STYLES[log.level];
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/90">
      <div className="flex">
        <div className={`w-1 shrink-0 ${style.bar}`} />
        <div className="min-w-0 flex-1 p-2">
          <div className="flex items-start gap-1.5">
            <span
              className={`shrink-0 rounded px-1 py-0.2 text-[8px] font-bold tracking-wider ${style.bg} ${style.fg}`}
            >
              {log.level}
            </span>
            <p className="line-clamp-2 font-mono text-[10.5px] leading-snug text-zinc-200">
              {log.message}
            </p>
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-zinc-500">
            <span className="text-zinc-400">{log.source}</span>
            <span>{log.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogsScreen({
  selectedFilter,
  onSelectFilter,
}: {
  selectedFilter: FilterType;
  onSelectFilter: (f: FilterType) => void;
}) {
  const filteredLogs =
    selectedFilter === "All"
      ? LOGS
      : LOGS.filter(
          (l) => l.level.toLowerCase() === selectedFilter.toLowerCase(),
        );

  return (
    <div className="flex h-full flex-col">
      {/* App bar */}
      <div className="flex shrink-0 items-center justify-between px-3.5 py-1.5">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-white">
            production-api
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-500" />
        </div>
        <Settings className="h-4 w-4 text-zinc-400" />
      </div>

      {/* Live connection banner */}
      <div className="flex shrink-0 items-center gap-1.5 bg-emerald-500/15 px-3.5 py-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[10px] font-semibold text-emerald-400">
          Live stream connected (ws)
        </span>
      </div>

      {/* Search preview */}
      <div className="shrink-0 px-3 pt-2">
        <div className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 text-[11px] text-zinc-500">
          <Search className="h-3 w-3" />
          <span>Filter logs...</span>
        </div>
      </div>

      {/* Interactive Level filter chips */}
      <div className="mt-2 flex shrink-0 gap-1 overflow-x-auto no-scrollbar px-3 pb-0.5">
        {FILTERS.map((label) => {
          const isSelected = selectedFilter === label;
          const dot = FILTER_DOT[label];
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelectFilter(label)}
              className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[9.5px] font-medium transition-colors ${
                isSelected
                  ? "border-zinc-500 bg-zinc-800 font-semibold text-white"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {dot && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: dot }}
                />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Log feed */}
      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto px-3 pb-6">
        {filteredLogs.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-center text-[10px] text-zinc-500">
            No {selectedFilter} logs in active buffer
          </div>
        ) : (
          filteredLogs.map((log) => <LogCard key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}

export default function LogstackMobile() {
  const [screen, setScreen] = useState<ScreenId>("logs");
  const [filter, setFilter] = useState<FilterType>("All");

  return (
    <div className="relative mx-auto w-full max-w-[280px] xs:max-w-[300px] sm:max-w-[320px]">
      {/* Screen Mode Tabs */}
      <div className="mb-3 flex items-center justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-xs">
        <button
          type="button"
          onClick={() => setScreen("logs")}
          className={`flex-1 rounded-lg px-2 py-1 text-center font-medium transition-all ${
            screen === "logs"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Live Triage
        </button>
        <button
          type="button"
          onClick={() => setScreen("push")}
          className={`flex-1 rounded-lg px-2 py-1 text-center font-medium transition-all ${
            screen === "push"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Push Alerts
        </button>
        <button
          type="button"
          onClick={() => setScreen("security")}
          className={`flex-1 rounded-lg px-2 py-1 text-center font-medium transition-all ${
            screen === "security"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Security
        </button>
      </div>

      {/* Crisp Native Phone Device Frame (no CSS scale blur) */}
      <div className="relative mx-auto h-[500px] sm:h-[540px] w-full overflow-hidden rounded-[2.5rem] border-[8px] sm:border-[10px] border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-2 z-40 flex h-4.5 w-24 -translate-x-1/2 items-center justify-center rounded-full bg-black">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500/40" />
        </div>

        {/* Screen Canvas */}
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#09090b]">
          <StatusBar />

          <div className="relative min-h-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen}
                className="absolute inset-0"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {screen === "logs" && (
                  <LogsScreen
                    selectedFilter={filter}
                    onSelectFilter={setFilter}
                  />
                )}
                {screen === "push" && (
                  <PushScreen onSwitchToLogs={() => setScreen("logs")} />
                )}
                {screen === "security" && (
                  <SecurityScreen onSwitchToLogs={() => setScreen("logs")} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Home indicator */}
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-zinc-700/80" />
        </div>
      </div>

      {/* Interactive Hint */}
      <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
        <Check className="h-3.5 w-3.5 text-emerald-400" />
        <span>Interactive preview • Tap chips & tabs</span>
      </div>
    </div>
  );
}
