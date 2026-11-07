"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  Terminal,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SdkId = "node" | "python" | "go";

interface SdkConfig {
  id: SdkId;
  label: string;
  runtime: string;
  filename: string;
  installCommand: string;
  docsHref: string;
  docsLabel: string;
  icon: (className?: string) => ReactNode;
  lines: { code: ReactNode; raw: string }[];
}

function TypeScriptIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect width="24" height="24" rx="4" fill="#3178C6" />
      <path
        d="M12.5 15.5c.5.8 1.4 1.3 2.5 1.3 1.3 0 2.2-.7 2.2-1.8 0-1.1-.7-1.6-1.9-2.1l-.7-.3c-1.8-.7-2.9-1.6-2.9-3.4 0-2.1 1.7-3.6 4.1-3.6 1.7 0 3 .6 3.8 1.8l-1.6 1.1c-.5-.7-1.2-1.1-2.2-1.1-1.2 0-2 .7-2 1.7 0 1 .7 1.5 1.8 2l.7.3c2 .9 3 1.7 3 3.6 0 2.2-1.7 3.8-4.3 3.8-2 0-3.5-.8-4.3-2.1l1.7-1.3zM5.5 8h6v2h-2v8h-2v-8h-2V8z"
        fill="#ffffff"
      />
    </svg>
  );
}

function PythonIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        d="M11.9 2c-3.1 0-5 1.4-5 3.7v2.6h5.2v.7H4.3C2.1 9 1 10.9 1 13.9c0 3 1.2 4.9 3.3 4.9h2v-2.3c0-2.4 1.9-4.3 4.3-4.3h5.2c1.9 0 3.5-1.5 3.5-3.5V5.7C19.3 3.4 17.3 2 11.9 2zm-1.8 1.8c.6 0 1.1.5 1.1 1.1 0 .6-.5 1.1-1.1 1.1s-1.1-.5-1.1-1.1c0-.6.5-1.1 1.1-1.1z"
        fill="#387EB8"
      />
      <path
        d="M12.1 22c3.1 0 5-1.4 5-3.7v-2.6h-5.2v-.7h7.8c2.2 0 3.3-1.9 3.3-4.9 0-3-1.2-4.9-3.3-4.9h-2v2.3c0 2.4-1.9 4.3-4.3 4.3H8.2c-1.9 0-3.5 1.5-3.5 3.5v3.1c0 2.3 2 3.7 7.4 3.7zm1.8-1.8c-.6 0-1.1-.5-1.1-1.1 0-.6.5-1.1 1.1-1.1s1.1.5 1.1 1.1c0 .6-.5 1.1-1.1 1.1z"
        fill="#FFE052"
      />
    </svg>
  );
}

function GoIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="4" fill="#00ADD8" />
      <path
        d="M7.8 8.6c.3-.5.7-.9 1.2-1.1.6-.3 1.3-.4 2.2-.4.9 0 1.6.2 2.2.6.5.4.9.9 1.1 1.6h-1.8c-.1-.3-.3-.5-.5-.7-.3-.2-.6-.3-1-.3-.6 0-1 .2-1.3.6-.3.4-.5.9-.5 1.7 0 .8.2 1.4.5 1.8.3.4.8.6 1.4.6.4 0 .7-.1.9-.3.2-.2.4-.4.5-.8h-1.6v-1.4h3.3v4h-1.1l-.1-.7c-.3.3-.6.5-1 .7-.4.2-.9.2-1.4.2-1 0-1.8-.3-2.4-.8-.6-.6-.9-1.5-.9-2.7 0-1.3.3-2.1 1-2.7zm9.6 1.8c.4.6.6 1.4.6 2.3 0 1-.2 1.8-.6 2.4-.4.6-1.1.9-2 .9s-1.5-.3-2-.9c-.4-.6-.6-1.4-.6-2.4s.2-1.8.6-2.3c.4-.6 1.1-.9 2-.9s1.6.3 2 .9zm-2.8 1.4c-.2.3-.3.7-.3 1.2s.1.9.3 1.2c.2.3.5.5.9.5s.7-.2.9-.5c.2-.3.3-.7.3-1.2s-.1-.9-.3-1.2c-.2-.3-.5-.5-.9-.5s-.7.2-.9.5z"
        fill="#ffffff"
      />
    </svg>
  );
}

const SDKS: Record<SdkId, SdkConfig> = {
  node: {
    id: "node",
    label: "TypeScript / Node",
    runtime: "Node.js 18+",
    filename: "logger.ts",
    installCommand: "npm install logstack-js",
    docsHref: "/docs/sdk/javascript",
    docsLabel: "JavaScript & TypeScript Docs",
    icon: (cls) => <TypeScriptIcon className={cls} />,
    lines: [
      {
        code: (
          <span>
            <span className="text-purple-400">import</span> &#123;{" "}
            <span className="text-sky-300">createLogStack</span> &#125;{" "}
            <span className="text-purple-400">from</span>{" "}
            <span className="text-emerald-300">&quot;logstack-js&quot;</span>;
          </span>
        ),
        raw: 'import { createLogStack } from "logstack-js";',
      },
      { code: <span />, raw: "" },
      {
        code: (
          <span>
            <span className="text-purple-400">export const</span>{" "}
            <span className="text-amber-300">logger</span> ={" "}
            <span className="text-sky-300">createLogStack</span>(&#123;
          </span>
        ),
        raw: "export const logger = createLogStack({",
      },
      {
        code: (
          <span className="pl-4">
            apiKey: <span className="text-sky-300">process</span>.
            <span className="text-sky-300">env</span>.
            <span className="text-emerald-400">LOGSTACK_API_KEY</span>,
          </span>
        ),
        raw: "  apiKey: process.env.LOGSTACK_API_KEY,",
      },
      {
        code: (
          <span className="pl-4">
            environment: <span className="text-sky-300">process</span>.
            <span className="text-sky-300">env</span>.
            <span className="text-emerald-400">NODE_ENV</span> ??{" "}
            <span className="text-emerald-300">&quot;production&quot;</span>,
          </span>
        ),
        raw: '  environment: process.env.NODE_ENV ?? "production",',
      },
      {
        code: (
          <span className="pl-4">
            service:{" "}
            <span className="text-emerald-300">&quot;api-gateway&quot;</span>,
          </span>
        ),
        raw: '  service: "api-gateway",',
      },
      { code: <span>&#125;);</span>, raw: "});" },
      { code: <span />, raw: "" },
      {
        code: (
          <span className="text-zinc-500">
            // Non-blocking structured telemetry dispatched in milliseconds
          </span>
        ),
        raw: "// Non-blocking structured telemetry dispatched in milliseconds",
      },
      {
        code: (
          <span>
            <span className="text-purple-400">export async function</span>{" "}
            <span className="text-sky-300">handleCheckout</span>(
            <span className="text-orange-300">order</span>:{" "}
            <span className="text-yellow-300">Order</span>) &#123;
          </span>
        ),
        raw: "export async function handleCheckout(order: Order) {",
      },
      {
        code: (
          <span className="pl-4">
            <span className="text-purple-400">await</span>{" "}
            <span className="text-amber-300">logger</span>.
            <span className="text-sky-300">info</span>(
            <span className="text-emerald-300">
              &quot;Checkout completed&quot;
            </span>
            , &#123;
          </span>
        ),
        raw: '  await logger.info("Checkout completed", {',
      },
      {
        code: (
          <span className="pl-8">
            userId: <span className="text-orange-300">order</span>.userId,
          </span>
        ),
        raw: "    userId: order.userId,",
      },
      {
        code: (
          <span className="pl-8">
            amount: <span className="text-orange-300">order</span>.totalCents,
          </span>
        ),
        raw: "    amount: order.totalCents,",
      },
      {
        code: (
          <span className="pl-8">
            currency: <span className="text-emerald-300">&quot;USD&quot;</span>,
          </span>
        ),
        raw: '    currency: "USD",',
      },
      {
        code: (
          <span className="pl-8">
            plan: <span className="text-emerald-300">&quot;pro_annual&quot;</span>,
          </span>
        ),
        raw: '    plan: "pro_annual",',
      },
      { code: <span className="pl-4">&#125;);</span>, raw: "  });" },
      { code: <span>&#125;</span>, raw: "}" },
    ],
  },
  python: {
    id: "python",
    label: "Python",
    runtime: "Python 3.8+",
    filename: "service.py",
    installCommand: "pip install logstack-py",
    docsHref: "/docs/sdk/python",
    docsLabel: "Python SDK Docs",
    icon: (cls) => <PythonIcon className={cls} />,
    lines: [
      {
        code: (
          <span>
            <span className="text-purple-400">import</span> os
          </span>
        ),
        raw: "import os",
      },
      {
        code: (
          <span>
            <span className="text-purple-400">from</span> fastapi{" "}
            <span className="text-purple-400">import</span> FastAPI
          </span>
        ),
        raw: "from fastapi import FastAPI",
      },
      {
        code: (
          <span>
            <span className="text-purple-400">from</span> logstack{" "}
            <span className="text-purple-400">import</span> LogStackClient
          </span>
        ),
        raw: "from logstack import LogStackClient",
      },
      { code: <span />, raw: "" },
      {
        code: (
          <span>
            app = <span className="text-sky-300">FastAPI</span>()
          </span>
        ),
        raw: "app = FastAPI()",
      },
      {
        code: (
          <span>
            logger = <span className="text-sky-300">LogStackClient</span>(
          </span>
        ),
        raw: "logger = LogStackClient(",
      },
      {
        code: (
          <span className="pl-4">
            api_key=os.environ[
            <span className="text-emerald-300">
              &quot;LOGSTACK_API_KEY&quot;
            </span>
            ],
          </span>
        ),
        raw: '    api_key=os.environ["LOGSTACK_API_KEY"],',
      },
      {
        code: (
          <span className="pl-4">
            environment=
            <span className="text-emerald-300">&quot;production&quot;</span>,
          </span>
        ),
        raw: '    environment="production",',
      },
      {
        code: (
          <span className="pl-4">
            service=
            <span className="text-emerald-300">&quot;checkout-worker&quot;</span>,
          </span>
        ),
        raw: '    service="checkout-worker",',
      },
      { code: <span>)</span>, raw: ")" },
      { code: <span />, raw: "" },
      {
        code: (
          <span className="text-zinc-500">
            # Auto-captures environment, thread context &amp; structured dict
          </span>
        ),
        raw: "# Auto-captures environment, thread context & structured dict",
      },
      {
        code: (
          <span>
            <span className="text-purple-400">@app</span>.
            <span className="text-sky-300">post</span>(
            <span className="text-emerald-300">&quot;/checkout&quot;</span>)
          </span>
        ),
        raw: '@app.post("/checkout")',
      },
      {
        code: (
          <span>
            <span className="text-purple-400">def</span>{" "}
            <span className="text-sky-300">checkout</span>(user_id: str, plan:
            str):
          </span>
        ),
        raw: "def checkout(user_id: str, plan: str):",
      },
      {
        code: (
          <span className="pl-4">
            logger.<span className="text-sky-300">info</span>(
          </span>
        ),
        raw: "    logger.info(",
      },
      {
        code: (
          <span className="pl-8">
            <span className="text-emerald-300">
              &quot;Checkout completed&quot;
            </span>
            ,
          </span>
        ),
        raw: '        "Checkout completed",',
      },
      {
        code: (
          <span className="pl-8">
            metadata=&#123;
            <span className="text-emerald-300">&quot;userId&quot;</span>:
            user_id,{" "}
            <span className="text-emerald-300">&quot;plan&quot;</span>: plan,{" "}
            <span className="text-emerald-300">&quot;amount&quot;</span>:{" "}
            <span className="text-orange-300">2900</span>&#125;,
          </span>
        ),
        raw: '        metadata={"userId": user_id, "plan": plan, "amount": 2900},',
      },
      { code: <span className="pl-4">)</span>, raw: "    )" },
      {
        code: (
          <span className="pl-4">
            <span className="text-purple-400">return</span> &#123;
            <span className="text-emerald-300">&quot;status&quot;</span>:{" "}
            <span className="text-emerald-300">&quot;ok&quot;</span>&#125;
          </span>
        ),
        raw: '    return {"status": "ok"}',
      },
    ],
  },
  go: {
    id: "go",
    label: "Go",
    runtime: "Go 1.21+",
    filename: "checkout.go",
    installCommand:
      "go get github.com/mosesedem/logstack/packages/logstack-go-sdk@v1.0.3",
    docsHref: "/docs/sdk/go",
    docsLabel: "Go SDK Docs",
    icon: (cls) => <GoIcon className={cls} />,
    lines: [
      {
        code: (
          <span>
            <span className="text-purple-400">package</span> main
          </span>
        ),
        raw: "package main",
      },
      { code: <span />, raw: "" },
      {
        code: (
          <span>
            <span className="text-purple-400">import</span> (
          </span>
        ),
        raw: "import (",
      },
      {
        code: (
          <span className="pl-4 text-emerald-300">
            &quot;context&quot;
          </span>
        ),
        raw: '    "context"',
      },
      {
        code: <span className="pl-4 text-emerald-300">&quot;os&quot;</span>,
        raw: '    "os"',
      },
      {
        code: (
          <span className="pl-4">
            logstack{" "}
            <span className="text-emerald-300">
              &quot;github.com/mosesedem/logstack/packages/logstack-go-sdk&quot;
            </span>
          </span>
        ),
        raw: '    logstack "github.com/mosesedem/logstack/packages/logstack-go-sdk"',
      },
      { code: <span>)</span>, raw: ")" },
      { code: <span />, raw: "" },
      {
        code: (
          <span>
            <span className="text-purple-400">func</span>{" "}
            <span className="text-sky-300">RecordCheckout</span>(ctx context.Context,
            userID, plan string) error &#123;
          </span>
        ),
        raw: "func RecordCheckout(ctx context.Context, userID, plan string) error {",
      },
      {
        code: (
          <span className="pl-4">
            client := logstack.
            <span className="text-sky-300">NewClient</span>(logstack.Config&#123;
          </span>
        ),
        raw: "    client := logstack.NewClient(logstack.Config{",
      },
      {
        code: (
          <span className="pl-8">
            APIKey: os.
            <span className="text-sky-300">Getenv</span>(
            <span className="text-emerald-300">
              &quot;LOGSTACK_API_KEY&quot;
            </span>
            ),
          </span>
        ),
        raw: '        APIKey: os.Getenv("LOGSTACK_API_KEY"),',
      },
      {
        code: (
          <span className="pl-8">
            Environment:{" "}
            <span className="text-emerald-300">&quot;production&quot;</span>,
          </span>
        ),
        raw: '        Environment: "production",',
      },
      {
        code: (
          <span className="pl-8">
            Service:{" "}
            <span className="text-emerald-300">&quot;checkout-api&quot;</span>,
          </span>
        ),
        raw: '        Service: "checkout-api",',
      },
      { code: <span className="pl-4">&#125;)</span>, raw: "    })" },
      {
        code: (
          <span className="pl-4">
            <span className="text-purple-400">defer</span> client.
            <span className="text-sky-300">Close</span>()
          </span>
        ),
        raw: "    defer client.Close()",
      },
      { code: <span />, raw: "" },
      {
        code: (
          <span className="pl-4">
            <span className="text-purple-400">return</span> client.
            <span className="text-sky-300">Info</span>(ctx,{" "}
            <span className="text-emerald-300">
              &quot;Checkout completed&quot;
            </span>
            , map[string]interface&#123;&#125;&#123;
          </span>
        ),
        raw: '    return client.Info(ctx, "Checkout completed", map[string]interface{}{',
      },
      {
        code: (
          <span className="pl-8">
            <span className="text-emerald-300">&quot;userId&quot;</span>: userID,
          </span>
        ),
        raw: '        "userId": userID,',
      },
      {
        code: (
          <span className="pl-8">
            <span className="text-emerald-300">&quot;plan&quot;</span>: plan,
          </span>
        ),
        raw: '        "plan": plan,',
      },
      {
        code: (
          <span className="pl-8">
            <span className="text-emerald-300">&quot;amount&quot;</span>:{" "}
            <span className="text-orange-300">2900</span>,
          </span>
        ),
        raw: '        "amount": 2900,',
      },
      { code: <span className="pl-4">&#125;)</span>, raw: "    })" },
      { code: <span>&#125;</span>, raw: "}" },
    ],
  },
};

export function InstallLogstack() {
  const [selectedSdk, setSelectedSdk] = useState<SdkId>("node");
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const active = SDKS[selectedSdk];

  const handleCopyInstall = async () => {
    try {
      await navigator.clipboard.writeText(active.installCommand);
      setCopiedInstall(true);
      setTimeout(() => setCopiedInstall(false), 1600);
    } catch {
      // ignore
    }
  };

  const handleCopyCode = async () => {
    try {
      const fullText = active.lines.map((l) => l.raw).join("\n");
      await navigator.clipboard.writeText(fullText);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <section
      id="install"
      className="relative z-10 mx-auto w-full min-w-0 max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-20 lg:py-24"
    >
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-emerald-400">
            <Code2 className="size-3.5 text-emerald-400" />
            <span>Multi-Language Client SDKs</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-5xl">
            Install once. Ship from any runtime.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Standardized client libraries with unified batching, automatic context,
            and sub-millisecond local queues. Your services, APIs, and microservices
            converge on one live ingest stream.
          </p>
        </div>

        <Link
          href="/docs"
          className="inline-flex w-full sm:w-auto items-center justify-center shrink-0 gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-medium text-white transition-all hover:border-zinc-500 hover:bg-zinc-800"
        >
          <span>Explore SDK documentation</span>
          <ArrowRight className="size-3.5 sm:size-4 text-emerald-400" />
        </Link>
      </div>

      {/* Editor & Installation Window */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Runtime Tabs Header */}
        <div className="flex flex-col gap-2.5 border-b border-zinc-800/80 bg-zinc-900/60 p-3 sm:px-4 sm:py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(["node", "python", "go"] as const).map((id) => {
              const item = SDKS[id];
              const isSelected = selectedSdk === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedSdk(id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "border border-zinc-700 bg-zinc-800 text-white shadow-sm"
                      : "border border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  {item.icon("size-3.5 sm:size-4")}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Terminal className="size-3.5 text-zinc-500" />
              <span>{active.filename}</span>
            </span>
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] sm:text-[11px] text-zinc-400">
              {active.runtime}
            </span>
          </div>
        </div>

        {/* Package Manager Command Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 bg-black/40 px-3.5 py-2 sm:px-4 sm:py-2.5">
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs sm:text-[13px]">
            <span className="font-semibold text-emerald-400 select-none">$</span>
            <code className="truncate text-zinc-200 select-all font-mono">
              {active.installCommand}
            </code>
          </div>

          <button
            type="button"
            onClick={handleCopyInstall}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-mono text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
          >
            {copiedInstall ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3 text-zinc-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Code Header Bar with Copy snippet (no floating obstruction) */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950 px-3.5 py-1.5 sm:px-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[11px]">Usage</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-300 text-[11px] font-semibold">{active.filename}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-mono text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
          >
            {copiedCode ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3 text-zinc-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code View with Line Numbers */}
        <div className="overflow-x-auto touch-pan-x p-3.5 font-mono text-[11.5px] leading-relaxed text-zinc-300 sm:p-5 sm:text-[13px]">
          <div className="min-w-max space-y-1">
            {active.lines.map((line, idx) => (
              <div key={idx} className="flex items-start gap-3 sm:gap-4">
                <span className="w-5 sm:w-6 shrink-0 select-none text-right font-mono text-zinc-600 text-[11px] sm:text-xs">
                  {idx + 1}
                </span>
                <div className="flex-1 whitespace-pre">{line.code}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SDK Bottom Bar */}
        <div className="flex flex-col gap-2 border-t border-zinc-800 bg-zinc-900/40 p-3 sm:px-4 sm:py-3 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span>Structured batching with automatic local queue fallback</span>
          </div>

          <Link
            href={active.docsHref}
            className="inline-flex items-center gap-1 text-emerald-400 hover:underline shrink-0"
          >
            <span>{active.docsLabel}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
