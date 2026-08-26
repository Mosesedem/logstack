/* eslint-disable react/no-unescaped-entities */
"use client";
import { useEffect, useState } from "react";
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
  // Box,
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
import { LiveLogTerminal } from "@/components/LiveLogTerminal";
/* ------------------------------------------------------------------ */
/*  Signature element: a live, looping log stream. Every project we   */
/*  build ends up staring at exactly this — so the hero stares back.  */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Cycling headline word — the same stutter-reveal beat as a build    */
/*  pipeline settling on its final state.                              */
/* ------------------------------------------------------------------ */

const HERO_WORDS = ["lightspeed", "zero drift", "full context"];

function CyclingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
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
          className={`col-start-1 row-start-1 text-transparent bg-clip-text bg-green-400 transition-all duration-500 ease-out ${
            i === index
              ? "opacity-100 translate-y-0 blur-0"
              : "opacity-0 -translate-y-2 blur-sm pointer-events-none"
          }`}
        >
          {word}
        </span>
      ))}
      {/* reserves width for the longest word so layout doesn't jump */}
      <span className="invisible col-start-1 row-start-1">
        {HERO_WORDS.reduce((a, b) => (a.length > b.length ? a : b))}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden selection:bg-emerald-500/20">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_40%,transparent_100%)] pointer-events-none" />

      <Navbar />

      {/* Hero */}
      <section className="relative z-10 container mx-auto px-4 pt-32 pb-20 text-center">
        <div className="mx-auto max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300 mb-8 hover:bg-white/10 transition-colors"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            V1.3 Now Available <span className="hidden sm:inline">|</span>{" "}
            <span className="hidden sm:inline">
              New features, improved performance, and enhanced security.
            </span>{" "}
            <ArrowRight className="h-3 w-3" />
          </Link>

          <h1 className="mb-8 text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl leading-[0.95]">
            Logs that ship
            <br />
            at <CyclingWord />
          </h1>

          <p className="mb-10 text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            The open-source logging platform for modern engineering teams.
            Real-time streaming, smart alerts, and instant insights without the
            enterprise price tag.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Button
              size="lg"
              className="h-12 rounded-full px-8 text-base bg-white text-black hover:bg-zinc-200"
              asChild
            >
              <Link href="/signup">
                Start Deploying <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full px-8 text-base border-zinc-800 bg-black/50 hover:bg-zinc-900 hover:text-white"
              asChild
            >
              <Link
                href="https://github.com/mosesedem/logstack"
                target="_blank"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 21.8 24 17.3 24 12c0-6.63-5.373-12-12-12Z" />
                </svg>
                Star on GitHub
              </Link>
            </Button>
          </div>

          <LiveLogTerminal />
        </div>
      </section>

      {/* Code snippet */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="overflow-hidden rounded-xl border border-border bg-surface/60 shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-400/70" />
              <span className="size-2.5 rounded-full bg-yellow-400/70" />
              <span className="size-2.5 rounded-full bg-green-400/70" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Terminal className="size-3.5" />
              install-logstack.ts
            </div>
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              TypeScript
            </span>
          </div>
          <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed">
            <code>
              <span className="text-code-comment">
                {"// Initialize high-throughput telemetry"}
              </span>
              {"\n"}
              <span className="text-red-400">import</span>{" "}
              {"{ createLogStack }"} <span className="text-code-key">from</span>{" "}
              <span className="text-code-string">'logstack-js'</span>;{"\n\n"}
              <span className="text-blue-400">const</span> logstack =
              createLogStack({"{"}
              {"\n  "}apiKey: process.env.
              <span className="text-brand">LOGSTACK_API_KEY</span>,{"\n  "}
              environment:{" "}
              <span className="text-code-string">'production'</span>
              {"\n"}
              {"}"});{"\n\n"}
              <span className="text-code-comment">
                {"// Emit structured payload"}
              </span>
              {"\n"}
              <span className="text-purple-400">await</span> logstack.
              <span className="text-brand">info</span>(
              <span className="text-code-string">'User subscribed'</span>, {"{"}
              {"\n  "}plan:{" "}
              <span className="text-code-string">'pro_monthly'</span>,{"\n  "}
              revenue: <span className="text-purple-400"> 2900,</span>
              {"\n  "}userId:{" "}
              <span className="text-code-string">'usr_9021'</span>
              {"\n"}
              {"}"});
            </code>
          </pre>
        </div>
      </section>
      {/* Tech Stack Marquee */}
      <section className="relative z-10 border-y border-white/5 bg-black/40 py-12 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-8 text-sm font-medium text-zinc-500 uppercase tracking-widest">
            Works seamlessly with your favorite stack
          </p>
          <div className="w-full overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
            <div className="flex w-max animate-scroll-left hover:[animation-play-state:paused] py-4">
              {[...TECH_STACK, ...TECH_STACK].map((tech, index) => (
                <div
                  key={`${tech.id}-${index}`}
                  className="flex flex-col items-center gap-3 min-w-[100px] mx-6 md:mx-10 select-none group"
                >
                  <div className="w-12 h-12 text-white opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 [&>svg]:w-full [&>svg]:h-full">
                    {tech.icon}
                  </div>
                  <span className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">
                    {tech.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
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

      <section id="mobile" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid items-center gap-14 rounded-2xl border border-border bg-surface/40 p-8 md:grid-cols-2 md:p-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-brand">
              <Smartphone className="size-3.5" />
              Mobile first
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
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

            <div className="flex flex-wrap gap-4 items-center mt-4">
              <Button
                variant="outline"
                className="h-12 border-zinc-700 bg-zinc-800/50 text-zinc-300"
                onClick={() =>
                  window.open(
                    "https://apps.apple.com/app/logstack/id6787477135",
                    "_blank",
                  )
                }
              >
                <span className="mr-2 h-6 w-6 flex items-center justify-center">
                  <svg
                    fill="#ffffff"
                    viewBox="-2.4 -2.4 28.80 28.80"
                    xmlns="http://www.w3.org/2000/svg"
                    stroke="#ffffff"
                  >
                    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                  </svg>
                </span>
                App Store
              </Button>

              <Button
                variant="outline"
                className="h-12 border-zinc-700 bg-zinc-800/50 text-zinc-300"
                onClick={() =>
                  window.open(
                    "https://play.google.com/store/apps/details?id=tech.logstack.mobile",
                    "_blank",
                  )
                }
              >
                <span className="mr-2 h-6 w-6 flex items-center justify-center">
                  <svg
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <mask
                      id="mask0_87_8320"
                      mask-type="alpha"
                      maskUnits="userSpaceOnUse"
                      x="7"
                      y="3"
                      width="24"
                      height="26"
                    >
                      <path
                        d="M30.0484 14.4004C31.3172 15.0986 31.3172 16.9014 30.0484 17.5996L9.75627 28.7659C8.52052 29.4459 7 28.5634 7 27.1663L7 4.83374C7 3.43657 8.52052 2.55415 9.75627 3.23415L30.0484 14.4004Z"
                        fill="#C4C4C4"
                      />
                    </mask>
                    <g mask="url(#mask0_87_8320)">
                      <path
                        d="M7.63473 28.5466L20.2923 15.8179L7.84319 3.29883C7.34653 3.61721 7 4.1669 7 4.8339V27.1664C7 27.7355 7.25223 28.2191 7.63473 28.5466Z"
                        fill="url(#paint0_linear_87_8320)"
                      />
                      <path
                        d="M30.048 14.4003C31.3169 15.0985 31.3169 16.9012 30.048 17.5994L24.9287 20.4165L20.292 15.8175L24.6923 11.4531L30.048 14.4003Z"
                        fill="url(#paint1_linear_87_8320)"
                      />
                      <path
                        d="M24.9292 20.4168L20.2924 15.8179L7.63477 28.5466C8.19139 29.0232 9.02389 29.1691 9.75635 28.766L24.9292 20.4168Z"
                        fill="url(#paint2_linear_87_8320)"
                      />
                      <path
                        d="M7.84277 3.29865L20.2919 15.8177L24.6922 11.4533L9.75583 3.23415C9.11003 2.87878 8.38646 2.95013 7.84277 3.29865Z"
                        fill="url(#paint3_linear_87_8320)"
                      />
                    </g>
                    <defs>
                      <linearGradient
                        id="paint0_linear_87_8320"
                        x1="15.6769"
                        y1="10.874"
                        x2="7.07106"
                        y2="19.5506"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#00C3FF" />
                        <stop offset="1" stopColor="#1BE2FA" />
                      </linearGradient>
                      <linearGradient
                        id="paint1_linear_87_8320"
                        x1="20.292"
                        y1="15.8176"
                        x2="31.7381"
                        y2="15.8176"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#FFCE00" />
                        <stop offset="1" stopColor="#FFEA00" />
                      </linearGradient>
                      <linearGradient
                        id="paint2_linear_87_8320"
                        x1="7.36932"
                        y1="30.1004"
                        x2="22.595"
                        y2="17.8937"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#DE2453" />
                        <stop offset="1" stopColor="#FE3944" />
                      </linearGradient>
                      <linearGradient
                        id="paint3_linear_87_8320"
                        x1="8.10725"
                        y1="1.90137"
                        x2="22.5971"
                        y2="13.7365"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#11D574" />
                        <stop offset="1" stopColor="#01F176" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
                Google Play
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Mobile apps are in private beta. Store links go live at launch.
            </p>
          </div>
          <LogstackMobile />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-32 container mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-emerald-500/10 to-black border border-white/10 p-12 lg:p-24 text-center">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Zap className="w-64 h-64 text-white" />
          </div>

          <h2 className="mb-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl text-white">
            Ready to upgrade your logs?
          </h2>
          <p className="mb-10 text-xl text-zinc-300 max-w-2xl mx-auto">
            Join thousands of developers shipping better software with Logstack.
            Open source, powerful, and free to start.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="h-14 rounded-full px-10 text-lg bg-white text-black hover:bg-zinc-200"
              asChild
            >
              <Link href="/signup">Get Started for Free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 rounded-full px-10 text-lg border-zinc-700 hover:bg-zinc-800 hover:text-white"
              asChild
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-black pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-12">
            <div>
              <LogstackLogo
                href="/"
                size={28}
                className="mb-4 text-xl text-white"
                labelClassName="text-white"
              />
              <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
                The modern logging stack for forward-thinking engineering teams.
                Designed for scale, built for speed.
              </p>
            </div>
            <FooterLinkGroup title="Product" links={productFooterLinks} />
            <FooterLinkGroup title="Resources" links={resourcesFooterLinks} />
            <FooterLinkGroup title="Company" links={companyFooterLinks} />
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
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
    <div className="group bg-background p-8 transition-colors hover:bg-surface/60">
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface/70 text-brand">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
