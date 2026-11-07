"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  Smartphone,
  Code,
  Terminal,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TECH_STACK } from "./tech-stack";
import LogstackMobile from "@/components/MobileDesign";
import { LiveProductionStream } from "@/components/marketing/LiveProductionStream";
import { InstallLogstack } from "@/components/marketing/InstallLogstack";

const MOBILE_POINTS = [
  "Biometric authentication & hardware key support",
  "Push notification triggers for threshold alerts",
  "Offline log search with cached query buffers",
  "Team incident routing & status delegation",
];

const FEATURES = [
  {
    icon: <Zap className="size-5" />,
    title: "Real-time streaming",
    description:
      "Watch logs stream instantaneously over WebSockets. Diagnose production faults as if they occurred in your local shell.",
  },
  {
    icon: <Shield className="size-5" />,
    title: "Granular alerts",
    description:
      "Configure threshold triggers on log anomalies, error volume spikes, or business-critical metrics.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Visual analytics",
    description:
      "Transform structured JSON logs into actionable dashboards with aggregated time-series visualizations.",
  },
  {
    icon: <Smartphone className="size-5" />,
    title: "Mobile companion",
    description:
      "Triage infrastructure events on the go with dedicated iOS and Android monitoring apps.",
  },
  {
    icon: <Terminal className="size-5" />,
    title: "Self-hosted first",
    description:
      "Deploy seamlessly via Docker or Kubernetes. Retain 100% control over sensitive telemetry data.",
  },
  {
    icon: <Code className="size-5" />,
    title: "Type-safe SDKs",
    description:
      "Native bindings for TypeScript, Go, and Python. Catch logging schema mismatches at compile time.",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-x-hidden">
      <section className="relative z-10 container mx-auto px-4 pt-12 pb-12 text-center sm:pt-20 sm:pb-20 md:pt-24">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/changelog"
            className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white sm:mb-8 sm:px-4"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="shrink-0 font-semibold text-emerald-400 sm:text-zinc-300">v1.0</span>
            <span className="text-zinc-600">|</span>
            <span className="truncate text-zinc-400">
              Live streaming, smart alerts & SDKs
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-zinc-500" />
          </Link>

          <h1 className="mb-5 text-3xl font-semibold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl sm:mb-6">
            Logs that stream
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-500 bg-clip-text text-transparent">
              as they happen.
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-2xl px-1 text-sm leading-relaxed text-pretty text-zinc-400 sm:text-lg sm:leading-relaxed sm:mb-10">
            The developer-first log management platform. Ingest structured
            events in milliseconds, stream live via WebSockets, and alert before
            users report incidents.
          </p>

          <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              size="lg"
              className="h-11 w-full rounded-full bg-white px-8 text-sm font-medium text-black hover:bg-zinc-200 sm:h-12 sm:w-auto sm:text-base"
              asChild
            >
              <Link href="/signup">
                Start Deploying <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 w-full rounded-full border-zinc-800 bg-zinc-900/60 px-8 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-white sm:h-12 sm:w-auto sm:text-base"
              asChild
            >
              <Link
                href="https://github.com/mosesedem/logstack"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubMark />
                Star on GitHub
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <LiveProductionStream />

      <section className="relative z-10 overflow-hidden border-y border-white/5 bg-zinc-950/60 py-8 sm:py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-6 px-2 text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase sm:mb-8 sm:text-sm">
            Works seamlessly with your stack
          </p>
          <div className="w-full max-w-full overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_24px,_black_calc(100%-24px),transparent_100%)] sm:[mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
            <div className="flex w-max animate-scroll-left py-3 hover:[animation-play-state:paused]">
              {[...TECH_STACK, ...TECH_STACK].map((tech, index) => (
                <div
                  key={`${tech.id}-${index}`}
                  className="group mx-5 flex min-w-[90px] select-none flex-col items-center gap-2.5 sm:mx-8 md:mx-10"
                >
                  <div className="h-10 w-10 sm:h-12 sm:w-12 text-white opacity-60 grayscale transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:grayscale-0 [&>svg]:h-full [&>svg]:w-full">
                    {tech.icon}
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-white/60 transition-colors group-hover:text-white">
                    {tech.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <InstallLogstack />

      <section
        id="features"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-20 lg:py-24"
      >
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl md:text-5xl">
            Engineered for precision
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            An enterprise-grade logging engine built for clarity, ultra-low
            latency, and complete data ownership.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section
        id="mobile"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-12 sm:px-6 sm:pb-20 lg:pb-24"
      >
        <div className="grid min-w-0 items-center gap-8 overflow-hidden rounded-2xl border border-border bg-surface/40 p-4 sm:gap-12 sm:p-8 md:grid-cols-2 md:gap-14 md:p-14">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-emerald-400">
              <Smartphone className="size-3.5" />
              iOS & Android Companion
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl md:text-4xl">
              Control from your pocket.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Production issues do not wait for desktop access. Triage live
              incidents, acknowledge critical alerts, and review distributed
              traces straight from your phone.
            </p>

            <ul className="mt-6 space-y-2.5 sm:mt-8 sm:space-y-3">
              {MOBILE_POINTS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm">
                  <span className="mt-0.5 flex size-4.5 sm:size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <Check className="size-3" />
                  </span>
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex w-full flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap">
              <StoreBadge
                href="https://apps.apple.com/app/logstack/id6787477135"
                eyebrow="Download on the"
                label="App Store"
              >
                <AppleMark />
              </StoreBadge>
              <StoreBadge
                href="https://play.google.com/store/apps/details?id=tech.logstack.mobile"
                eyebrow="Get it on"
                label="Google Play"
              >
                <PlayMark />
              </StoreBadge>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Mobile apps are in private beta. Store links go live at launch.
            </p>
          </div>
          <div className="flex min-w-0 justify-center overflow-hidden pt-2 md:pt-0">
            <LogstackMobile />
          </div>
        </div>
      </section>

      <section className="relative z-10 container mx-auto px-4 py-12 sm:py-20 lg:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center sm:p-10 lg:p-14">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Ready to upgrade your logging stack?
          </h2>
          <p className="mx-auto mb-6 max-w-xl text-sm text-zinc-400 sm:text-base sm:mb-8">
            Deploy via Docker or send your first log with our SDKs in under 2
            minutes. Free and open source.
          </p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              size="lg"
              className="h-11 w-full rounded-full bg-white px-8 text-sm font-medium text-black hover:bg-zinc-200 sm:h-12 sm:w-auto sm:text-base"
              asChild
            >
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 w-full rounded-full border-zinc-800 bg-zinc-900/80 px-8 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white sm:h-12 sm:w-auto sm:text-base"
              asChild
            >
              <Link href="/docs">Read Documentation</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group bg-background p-5 sm:p-6 lg:p-8 transition-colors hover:bg-surface/60">
      <div className="flex size-9 sm:size-10 items-center justify-center rounded-lg border border-border bg-surface/70 text-brand">
        {icon}
      </div>
      <h3 className="mt-4 sm:mt-5 text-base sm:text-lg font-medium">{title}</h3>
      <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StoreBadge({
  href,
  eyebrow,
  label,
  children,
}: {
  href: string;
  eyebrow: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${eyebrow} ${label}`}
      className="inline-flex h-12 w-full sm:w-auto items-center justify-center sm:justify-start gap-3 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 text-left text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800 sm:min-w-[11.5rem]"
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        {children}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[10px] tracking-wide text-zinc-400 uppercase">
          {eyebrow}
        </span>
        <span className="block text-sm font-semibold">{label}</span>
      </span>
    </a>
  );
}

function GitHubMark() {
  return (
    <svg
      className="mr-2 size-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 21.8 24 17.3 24 12c0-6.63-5.373-12-12-12Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 fill-white" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83ZM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <path
        d="M7.63 28.55 20.29 15.82 7.84 3.3C7.35 3.62 7 4.17 7 4.83v22.33c0 .57.25 1.05.63 1.38Z"
        fill="#00C3FF"
      />
      <path
        d="M30.05 14.4c1.27.7 1.27 2.5 0 3.2l-5.12 2.82-4.64-4.6 4.4-4.36 5.36 2.95Z"
        fill="#FFCE00"
      />
      <path
        d="M24.93 20.42 20.29 15.82 7.63 28.55c.56.48 1.39.62 2.12.22l15.18-8.35Z"
        fill="#DE2453"
      />
      <path
        d="M7.84 3.3 20.29 15.82l4.4-4.36L9.76 3.23C9.11 2.88 8.39 2.95 7.84 3.3Z"
        fill="#11D574"
      />
    </svg>
  );
}
