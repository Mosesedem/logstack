"use client";
import { useEffect, useState, type ReactNode } from "react";
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
import { Navbar } from "@/components/marketing/Navbar";
import { FooterLinkGroup } from "@/components/marketing/footer-link-group";
import {
  companyFooterLinks,
  productFooterLinks,
  resourcesFooterLinks,
} from "@/lib/navigation";
import { LogstackLogo } from "@/components/brand/logstack-logo";
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

const HERO_WORDS = ["lightspeed", "zero drift", "full context"];

function CyclingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % HERO_WORDS.length),
      2600,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <span className="relative inline-grid">
      {HERO_WORDS.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 bg-green-400 bg-clip-text text-transparent transition-all duration-500 ease-out ${
            i === index
              ? "translate-y-0 opacity-100 blur-0"
              : "pointer-events-none -translate-y-2 opacity-0 blur-sm"
          }`}
        >
          {word}
        </span>
      ))}
      <span className="invisible col-start-1 row-start-1">
        {HERO_WORDS.reduce((a, b) => (a.length > b.length ? a : b))}
      </span>
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white selection:bg-emerald-500/20">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_40%,transparent_100%)]" />

      <Navbar />

      <section className="relative z-10 container mx-auto px-4 pt-20 pb-16 text-center sm:pt-32 sm:pb-20">
        <div className="mx-auto max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Link
            href="/changelog"
            className="mb-8 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 sm:px-4"
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="truncate">V1.3 Now Available</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">
              New features, improved performance, and enhanced security.
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </Link>

          <h1 className="mb-6 text-[2.35rem] font-semibold leading-[0.95] tracking-tight sm:mb-8 sm:text-6xl md:text-7xl lg:text-8xl">
            Logs that ship
            <br />
            at <CyclingWord />
          </h1>

          <p className="mx-auto mb-10 max-w-2xl px-1 text-base leading-relaxed text-pretty text-zinc-400 sm:text-xl">
            The open-source logging platform for modern engineering teams.
            Real-time streaming, smart alerts, and instant insights without the
            enterprise price tag.
          </p>

          <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              size="lg"
              className="h-12 w-full rounded-full bg-white px-8 text-base text-black hover:bg-zinc-200 sm:w-auto"
              asChild
            >
              <Link href="/signup">
                Start Deploying <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full rounded-full border-zinc-800 bg-black/50 px-8 text-base hover:bg-zinc-900 hover:text-white sm:w-auto"
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

      <section className="relative z-10 overflow-hidden border-y border-white/5 bg-black/40 py-12 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-8 px-2 text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase sm:text-sm sm:tracking-widest">
            Works seamlessly with your favorite stack
          </p>
          <div className="w-full max-w-full overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_24px,_black_calc(100%-24px),transparent_100%)] sm:[mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
            <div className="flex w-max animate-scroll-left py-4 hover:[animation-play-state:paused]">
              {[...TECH_STACK, ...TECH_STACK].map((tech, index) => (
                <div
                  key={`${tech.id}-${index}`}
                  className="group mx-6 flex min-w-[100px] select-none flex-col items-center gap-3 md:mx-10"
                >
                  <div className="h-12 w-12 text-white opacity-60 grayscale transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:grayscale-0 [&>svg]:h-full [&>svg]:w-full">
                    {tech.icon}
                  </div>
                  <span className="text-sm font-medium text-white/60 transition-colors group-hover:text-white">
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
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24"
      >
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
            Engineered for precision
          </h2>
          <p className="mt-4 text-muted-foreground">
            An enterprise-grade logging engine built for clarity, ultra-low
            latency, and complete data ownership.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section
        id="mobile"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6 sm:pb-24"
      >
        <div className="grid min-w-0 items-center gap-10 overflow-hidden rounded-2xl border border-border bg-surface/40 p-5 sm:gap-12 sm:p-8 md:grid-cols-2 md:gap-14 md:p-14">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-brand">
              <Smartphone className="size-3.5" />
              Mobile first
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl md:text-4xl">
              Control from your pocket.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Production issues do not wait for desktop access. Triage live
              incidents, acknowledge critical alerts, and review distributed
              traces straight from your phone.
            </p>

            <ul className="mt-8 space-y-3">
              {MOBILE_POINTS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <Check className="size-3" />
                  </span>
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
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
          <div className="flex min-w-0 justify-center overflow-hidden">
            <LogstackMobile />
          </div>
        </div>
      </section>

      <section className="relative z-10 container mx-auto px-4 py-20 sm:py-32">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-emerald-500/10 to-black p-8 text-center sm:p-12 lg:p-24">
          <div className="pointer-events-none absolute top-0 right-0 hidden p-12 opacity-10 sm:block">
            <Zap className="h-64 w-64 text-white" />
          </div>

          <h2 className="mb-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Ready to upgrade your logs?
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-base text-zinc-300 sm:text-xl">
            Join thousands of developers shipping better software with Logstack.
            Open source, powerful, and free to start.
          </p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              size="lg"
              className="h-12 w-full rounded-full bg-white px-10 text-base text-black hover:bg-zinc-200 sm:h-14 sm:w-auto sm:text-lg"
              asChild
            >
              <Link href="/signup">Get Started for Free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full rounded-full border-zinc-700 px-10 text-base hover:bg-zinc-800 hover:text-white sm:h-14 sm:w-auto sm:text-lg"
              asChild
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-black pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="mb-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <LogstackLogo
                href="/"
                size={28}
                className="mb-4 text-xl text-white"
                labelClassName="text-white"
              />
              <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
                The modern logging stack for forward-thinking engineering teams.
                Designed for scale, built for speed.
              </p>
            </div>
            <FooterLinkGroup title="Product" links={productFooterLinks} />
            <FooterLinkGroup title="Resources" links={resourcesFooterLinks} />
            <FooterLinkGroup title="Company" links={companyFooterLinks} />
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} Logstack Inc. All rights reserved.
            </p>
            <div className="flex gap-6 text-xs text-zinc-600">
              <Link href="/privacy" className="hover:text-zinc-400">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-zinc-400">
                Terms of Service
              </Link>
              <Link href="/cookies" className="hover:text-zinc-400">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
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
    <div className="group bg-background p-6 transition-colors hover:bg-surface/60 sm:p-8">
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface/70 text-brand">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
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
      className="inline-flex h-14 w-full items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 text-left text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800 sm:h-12 sm:w-auto sm:min-w-[11.5rem]"
    >
      <span className="flex size-7 shrink-0 items-center justify-center">
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
