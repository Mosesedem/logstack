"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Battery,
  Bell,
  Check,
  Fingerprint,
  Lock,
  LockOpen,
  QrCode,
  Search,
  Settings,
  Signal,
  ChevronsUpDown,
  Wifi,
} from "lucide-react";
import { LogstackLogo } from "@/components/brand/logstack-logo";

/**
 * Landing mockup of the Logstack Flutter companion app.
 * Design tokens + screen copy mirror apps/mobile (logstack_colors, onboarding, logs).
 */

type ScreenId = "splash" | "push" | "security" | "login" | "logs";

const SCREENS: { id: ScreenId; durationMs: number }[] = [
  { id: "splash", durationMs: 2800 },
  { id: "push", durationMs: 2600 },
  { id: "security", durationMs: 3000 },
  { id: "login", durationMs: 2800 },
  { id: "logs", durationMs: 5200 },
];

const LOGS = [
  {
    id: 1,
    level: "CRITICAL" as const,
    message: "DB Connection Timeout",
    source: "api",
    time: "2m ago",
  },
  {
    id: 2,
    level: "ERROR" as const,
    message: "Payment webhook failed",
    source: "billing",
    time: "5m ago",
  },
  {
    id: 3,
    level: "WARN" as const,
    message: "Rate limit approaching",
    source: "gateway",
    time: "14m ago",
  },
  {
    id: 4,
    level: "INFO" as const,
    message: "Worker process started",
    source: "worker",
    time: "20m ago",
  },
  {
    id: 5,
    level: "DEBUG" as const,
    message: "Cache warm complete",
    source: "cache",
    time: "1h ago",
  },
];

const LEVEL_STYLES = {
  CRITICAL: {
    fg: "text-[#b91c1c]",
    bg: "bg-[#b91c1c]/20",
    bar: "bg-[#b91c1c]",
    chip: "border-[#b91c1c]/50",
  },
  ERROR: {
    fg: "text-[#ef4444]",
    bg: "bg-[#ef4444]/20",
    bar: "bg-[#ef4444]",
    chip: "border-[#ef4444]/50",
  },
  WARN: {
    fg: "text-[#eab308]",
    bg: "bg-[#eab308]/20",
    bar: "bg-[#eab308]",
    chip: "border-[#eab308]/50",
  },
  INFO: {
    fg: "text-[#3b82f6]",
    bg: "bg-[#3b82f6]/20",
    bar: "bg-[#3b82f6]",
    chip: "border-[#3b82f6]/50",
  },
  DEBUG: {
    fg: "text-[#c084fc]",
    bg: "bg-[#c084fc]/20",
    bar: "bg-[#c084fc]",
    chip: "border-[#c084fc]/50",
  },
} as const;

const FILTERS = ["All", "Debug", "Info", "Warn", "Error", "Critical"] as const;

const FILTER_DOT: Record<string, string | null> = {
  All: null,
  Debug: "#c084fc",
  Info: "#3b82f6",
  Warn: "#eab308",
  Error: "#ef4444",
  Critical: "#b91c1c",
};

const screenMotion = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -14 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

function AppLogoMark({ size = 72 }: { size?: number }) {
  return (
    <div className="relative flex shrink-0 items-center justify-center shadow-lg shadow-black/40">
      <LogstackLogo href={null} showLabel={false} size={size} priority />
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-5 pt-3 text-[11px] font-semibold text-zinc-300">
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
  className = "",
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#fafafa] px-5 text-[13px] font-semibold text-[#09090b] ${className}`}
    >
      {icon}
      {children}
    </div>
  );
}

function OutlinedButton({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#3f3f46] px-5 text-[13px] font-medium text-[#fafafa]">
      {icon}
      {children}
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="flex h-full flex-col px-6 pb-12 pt-2">
      <div className="flex flex-1 flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <AppLogoMark size={80} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="mt-7 text-center"
        >
          <h3 className="text-[22px] font-bold tracking-tight text-[#fafafa]">
            Logstack
          </h3>
          <p className="mt-2.5 text-[13px] leading-relaxed text-[#a1a1aa]">
            Real-time alerts and logs in your pocket
          </p>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.35 }}
      >
        <PrimaryButton>Get started</PrimaryButton>
        <p className="mt-2 text-center text-[11px] text-[#71717a]">
          Tap to continue
        </p>
      </motion.div>
    </div>
  );
}

function PushScreen() {
  return (
    <div className="flex h-full flex-col px-6 pb-12 pt-4">
      <div className="flex flex-col items-center pt-2">
        <AppLogoMark size={64} />
        <Bell className="mt-7 h-11 w-11 text-[#3b82f6]" strokeWidth={1.5} />
        <h3 className="mt-5 w-full text-left text-[18px] font-semibold text-[#fafafa]">
          Enable push notifications
        </h3>
        <p className="mt-2.5 text-left text-[12.5px] leading-relaxed text-[#a1a1aa]">
          Logstack sends alerts and escalations to this device. Without
          notifications, you may miss critical incidents.
        </p>
      </div>
      <div className="mt-auto">
        <PrimaryButton icon={<Bell className="h-4 w-4" />}>
          Enable notifications
        </PrimaryButton>
      </div>
    </div>
  );
}

function SecurityScreen() {
  return (
    <div className="flex h-full flex-col px-5 pb-12 pt-3">
      {/* Step progress — security setup */}
      <div className="mb-4 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-[3px] flex-1 rounded-sm ${
              i === 0 ? "bg-[#3b82f6]" : "bg-[#27272a]"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-col items-center">
        <AppLogoMark size={56} />
        <h3 className="mt-5 text-center text-[16px] font-semibold leading-snug text-[#fafafa]">
          How should Logstack protect your logs?
        </h3>
        <p className="mt-2 text-center text-[11px] text-[#a1a1aa]">
          You can change this anytime in Settings.
        </p>
      </div>

      <div className="mt-6 space-y-2.5">
        <div className="rounded-[14px] border border-white/10 bg-[#18181b] p-3.5">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3b82f6]/15">
              <Lock className="h-5 w-5 text-[#3b82f6]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[#fafafa]">
                  Protected
                </span>
                <span className="rounded-md bg-[#22c55e]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#22c55e]">
                  Recommended
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[#a1a1aa]">
                Lock with PIN or Face ID when you leave the app.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-white/10 bg-[#18181b] p-3.5 opacity-80">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-500/15">
              <LockOpen className="h-5 w-5 text-[#a1a1aa]" />
            </div>
            <div className="min-w-0">
              <span className="text-[13px] font-semibold text-[#fafafa]">
                Stay open
              </span>
              <p className="mt-1 text-[11px] leading-snug text-[#a1a1aa]">
                No lock screen until you sign out.
              </p>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#a1a1aa]"
      >
        <Fingerprint className="h-3.5 w-3.5 text-[#3b82f6]" />
        Biometric unlock available
      </motion.div>
    </div>
  );
}

function LoginScreen() {
  return (
    <div className="flex h-full flex-col px-6 pb-12 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center">
        <AppLogoMark size={72} />
        <h3 className="mt-6 text-[20px] font-bold tracking-tight text-[#fafafa]">
          Logstack
        </h3>
        <p className="mt-2 max-w-[220px] text-center text-[12.5px] leading-relaxed text-[#a1a1aa]">
          Link this device to your existing account
        </p>

        <div className="mt-8 w-full space-y-2.5">
          <PrimaryButton icon={<QrCode className="h-4 w-4" />}>
            Scan QR Code
          </PrimaryButton>
          <OutlinedButton icon={<Lock className="h-4 w-4" />}>
            Enter PIN
          </OutlinedButton>
        </div>

        <p className="mt-6 max-w-[230px] text-center text-[10.5px] leading-relaxed text-[#71717a]">
          Accounts are created on the web dashboard — not in this app.
        </p>
      </div>
    </div>
  );
}

function LogCard({
  level,
  message,
  source,
  time,
  index,
}: {
  level: keyof typeof LEVEL_STYLES;
  message: string;
  source: string;
  time: string;
  index: number;
}) {
  const style = LEVEL_STYLES[level];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.12, duration: 0.35 }}
      className="overflow-hidden rounded-[10px] border border-white/10 bg-[#18181b]"
    >
      <div className="flex">
        <div className={`w-1 shrink-0 ${style.bar}`} />
        <div className="min-w-0 flex-1 p-2.5">
          <div className="flex items-start gap-1.5">
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${style.bg} ${style.fg}`}
            >
              {level}
            </span>
            <p className="line-clamp-2 font-mono text-[11px] leading-snug text-[#fafafa]">
              {message}
            </p>
          </div>
          <div className="mt-1.5 flex gap-2 font-mono text-[9px] text-[#71717a]">
            <span>{time}</span>
            <span className="text-[#a1a1aa]">{source}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LogsScreen() {
  return (
    <div className="flex h-full flex-col">
      {/* App bar */}
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 items-center gap-0.5 text-left"
          tabIndex={-1}
        >
          <span className="truncate text-[15px] font-semibold text-[#fafafa]">
            production-api
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#71717a]" />
        </button>
        <Settings className="h-5 w-5 text-[#fafafa]" strokeWidth={1.75} />
      </div>

      {/* Live connection banner */}
      <div className="flex shrink-0 items-center gap-2 bg-[#22c55e]/12 px-3.5 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
        </span>
        <span className="text-[11px] font-semibold text-[#22c55e]">
          Live stream connected
        </span>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3.5 pt-2.5">
        <div className="flex h-9 items-center gap-2 rounded-[10px] border border-[#3f3f46] bg-[#18181b] px-2.5">
          <Search className="h-3.5 w-3.5 text-[#71717a]" />
          <span className="text-[12px] text-[#71717a]">Search logs…</span>
        </div>
      </div>

      {/* Level filter chips */}
      <div className="mt-2 flex shrink-0 gap-1.5 overflow-hidden px-3.5">
        {FILTERS.map((label, i) => {
          const selected = i === 0;
          const dot = FILTER_DOT[label];
          return (
            <div
              key={label}
              className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] ${
                selected
                  ? "border-[#a1a1aa]/50 bg-[#27272a] font-semibold text-[#fafafa]"
                  : "border-[#3f3f46] bg-[#18181b] font-medium text-[#a1a1aa]"
              }`}
            >
              {dot && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: dot }}
                />
              )}
              {label}
            </div>
          );
        })}
      </div>

      {/* Log feed */}
      <div className="mt-2 flex-1 space-y-2 overflow-hidden px-3.5 pb-12">
        {LOGS.map((log, index) => (
          <LogCard key={log.id} {...log} index={index} />
        ))}
      </div>
    </div>
  );
}

function ScreenContent({ screen }: { screen: ScreenId }) {
  switch (screen) {
    case "splash":
      return <SplashScreen />;
    case "push":
      return <PushScreen />;
    case "security":
      return <SecurityScreen />;
    case "login":
      return <LoginScreen />;
    case "logs":
      return <LogsScreen />;
  }
}

const LogstackMobile = () => {
  const [index, setIndex] = useState(0);
  const screen = SCREENS[index].id;

  useEffect(() => {
    const ms = SCREENS[index].durationMs;
    const t = window.setTimeout(() => {
      setIndex((i) => (i + 1) % SCREENS.length);
    }, ms);
    return () => window.clearTimeout(t);
  }, [index]);

  return (
    <div className="relative group">
      <div className="absolute inset-0 rounded-full bg-primary/30 opacity-50 blur-[120px] transition-opacity duration-500 group-hover:opacity-80" />

      {/* Device frame */}
      <div className="relative mx-auto h-[640px] w-[310px] overflow-hidden rounded-[3rem] border-[12px] border-zinc-900 bg-zinc-900 shadow-2xl">
        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-2 z-50 flex h-7 w-[118px] -translate-x-1/2 items-center justify-center rounded-full bg-black">
          <div className="h-2 w-2 rounded-full bg-blue-500/40 blur-[1px]" />
        </div>

        {/* Screen */}
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#09090b]">
          <StatusBar />

          <div className="relative min-h-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen}
                className="absolute inset-0"
                initial={screenMotion.initial}
                animate={screenMotion.animate}
                exit={screenMotion.exit}
                transition={screenMotion.transition}
              >
                <ScreenContent screen={screen} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Home indicator */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-zinc-700/80" />

          {/* Progress dots */}
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {SCREENS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === index
                    ? "w-4 bg-[#fafafa]"
                    : "w-1 bg-zinc-600"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Caption under phone — current step */}
      <div className="mt-5 flex justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={screen}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1.5 text-xs text-zinc-500"
          >
            {screen === "splash" && "Welcome & onboarding"}
            {screen === "push" && "Push alert setup"}
            {screen === "security" && "PIN & biometric lock"}
            {screen === "login" && "Link device via QR or PIN"}
            {screen === "logs" && (
              <>
                <Check className="h-3 w-3 text-[#22c55e]" />
                Live logs & triage on the go
              </>
            )}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LogstackMobile;
