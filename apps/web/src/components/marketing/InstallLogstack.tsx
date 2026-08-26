"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, Terminal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SdkId = "node" | "python" | "go";

const SDKS: {
  id: SdkId;
  label: string;
  runtime: string;
  filename: string;
  install: string;
  docsHref: string;
  docsLabel: string;
}[] = [
  {
    id: "node",
    label: "Node.js",
    runtime: "TypeScript",
    filename: "install-logstack.ts",
    install: "npm install logstack-js",
    docsHref: "/docs/sdk/javascript",
    docsLabel: "JavaScript / TypeScript docs",
  },
  {
    id: "python",
    label: "Python",
    runtime: "Python",
    filename: "install_logstack.py",
    install: "pip install logstack-py",
    docsHref: "/docs/sdk/python",
    docsLabel: "Python docs",
  },
  {
    id: "go",
    label: "Go",
    runtime: "Go",
    filename: "install_logstack.go",
    install:
      "go get github.com/mosesedem/logstack/packages/logstack-go-sdk@v1.0.3",
    docsHref: "/docs/sdk/go",
    docsLabel: "Go docs",
  },
];

const SNIPPETS: Record<SdkId, string> = {
  node: `import { createLogStack } from "logstack-js";

const logstack = createLogStack({
  apiKey: process.env.LOGSTACK_API_KEY ?? "",
  disabled: !process.env.LOGSTACK_API_KEY,
});

// Node / Next.js route — structured checkout event
export async function POST(req: Request) {
  const { userId, plan } = await req.json();

  await logstack.info("User subscribed", {
    plan,
    revenue: 2900,
    userId,
  });

  return Response.json({ ok: true });
}`,
  python: `import os
from fastapi import FastAPI
from logstack import LogStackClient

app = FastAPI()
client = LogStackClient(
    api_key=os.environ["LOGSTACK_API_KEY"],
    environment="production",
)

# FastAPI handler — same checkout event
@app.post("/checkout")
def checkout(user_id: str, plan: str):
    client.info("User subscribed", metadata={
        "plan": plan,
        "revenue": 2900,
        "userId": user_id,
    })
    return {"ok": True}`,
  go: `package main

import (
	"context"
	"os"

	logstack "github.com/mosesedem/logstack/packages/logstack-go-sdk"
)

func recordSubscription(ctx context.Context, userID, plan string) error {
	client := logstack.NewClient(logstack.Config{
		APIKey:      os.Getenv("LOGSTACK_API_KEY"),
		Environment: "production",
	})
	defer client.Close()

	// Checkout service — same structured event
	return client.Info(ctx, "User subscribed", map[string]interface{}{
		"plan":    plan,
		"revenue": 2900,
		"userId":  userID,
	})
}`,
};

function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-white ${className}`}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function Kw({ children }: { children: ReactNode }) {
  return <span className="text-code-keyword">{children}</span>;
}
function Str({ children }: { children: ReactNode }) {
  return <span className="text-code-string">{children}</span>;
}
function Cm({ children }: { children: ReactNode }) {
  return <span className="text-code-comment">{children}</span>;
}
function Fn({ children }: { children: ReactNode }) {
  return <span className="text-code-function">{children}</span>;
}
function Num({ children }: { children: ReactNode }) {
  return <span className="text-purple-400">{children}</span>;
}

function Lines({ rows }: { rows: ReactNode[] }) {
  return (
    <>
      {rows.map((row, index) => (
        <div key={index} className="min-h-[1.45em] whitespace-pre">
          {row}
        </div>
      ))}
    </>
  );
}

function NodeSnippet() {
  return (
    <Lines
      rows={[
        <>
          <Kw>import</Kw>
          {" { createLogStack } "}
          <Kw>from</Kw> <Str>&quot;logstack-js&quot;</Str>;
        </>,
        "",
        <>
          <Kw>const</Kw> logstack = <Fn>createLogStack</Fn>({"{"}
        </>,
        <>
          {"  apiKey: process.env."}
          <span className="text-emerald-400">LOGSTACK_API_KEY</span>
          {" ?? "}
          <Str>&quot;&quot;</Str>,
        </>,
        <>
          {"  disabled: !process.env."}
          <span className="text-emerald-400">LOGSTACK_API_KEY</span>,
        </>,
        "});",
        "",
        <Cm key="node-comment">
          {"// Node / Next.js route — structured checkout event"}
        </Cm>,
        <>
          <Kw>export async function</Kw> <Fn>POST</Fn>(req: Request) {"{"}
        </>,
        <>
          {"  "}
          <Kw>const</Kw>
          {" { userId, plan } = "}
          <Kw>await</Kw> req.<Fn>json</Fn>();
        </>,
        "",
        <>
          {"  "}
          <Kw>await</Kw> logstack.<Fn>info</Fn>(
          <Str>&quot;User subscribed&quot;</Str>, {"{"}
        </>,
        "    plan,",
        <>
          {"    revenue: "}
          <Num>2900</Num>,
        </>,
        "    userId,",
        "  });",
        "",
        <>
          {"  "}
          <Kw>return</Kw> Response.<Fn>json</Fn>({"{ ok: "}
          <Kw>true</Kw>
          {" });"}
        </>,
        "}",
      ]}
    />
  );
}

function PythonSnippet() {
  return (
    <Lines
      rows={[
        <>
          <Kw>import</Kw> os
        </>,
        <>
          <Kw>from</Kw> fastapi <Kw>import</Kw> FastAPI
        </>,
        <>
          <Kw>from</Kw> logstack <Kw>import</Kw> LogStackClient
        </>,
        "",
        <>
          app = <Fn>FastAPI</Fn>()
        </>,
        <>
          client = <Fn>LogStackClient</Fn>(
        </>,
        <>
          {"    api_key=os.environ["}
          <Str>&quot;LOGSTACK_API_KEY&quot;</Str>],
        </>,
        <>
          {"    environment="}
          <Str>&quot;production&quot;</Str>,
        </>,
        ")",
        "",
        <Cm key="py-comment">{"# FastAPI handler — same checkout event"}</Cm>,
        <>
          @app.post(<Str>&quot;/checkout&quot;</Str>)
        </>,
        <>
          <Kw>def</Kw> <Fn>checkout</Fn>(user_id: str, plan: str):
        </>,
        <>
          {"    client."}
          <Fn>info</Fn>(<Str>&quot;User subscribed&quot;</Str>, metadata={"{"}
        </>,
        <>
          {"        "}
          <Str>&quot;plan&quot;</Str>: plan,
        </>,
        <>
          {"        "}
          <Str>&quot;revenue&quot;</Str>: <Num>2900</Num>,
        </>,
        <>
          {"        "}
          <Str>&quot;userId&quot;</Str>: user_id,
        </>,
        "    })",
        <>
          {"    "}
          <Kw>return</Kw> {"{"}
          <Str>&quot;ok&quot;</Str>: <Kw>True</Kw>
          {"}"}
        </>,
      ]}
    />
  );
}

function GoSnippet() {
  return (
    <Lines
      rows={[
        <>
          <Kw>package</Kw> main
        </>,
        "",
        <>
          <Kw>import</Kw> (
        </>,
        <>
          {"\t"}
          <Str>&quot;context&quot;</Str>
        </>,
        <>
          {"\t"}
          <Str>&quot;os&quot;</Str>
        </>,
        "",
        <>
          {"\tlogstack "}
          <Str>
            &quot;github.com/mosesedem/logstack/packages/logstack-go-sdk&quot;
          </Str>
        </>,
        ")",
        "",
        <>
          <Kw>func</Kw> <Fn>recordSubscription</Fn>
          (ctx context.Context, userID, plan <Kw>string</Kw>) <Kw>error</Kw>{" "}
          {"{"}
        </>,
        <>
          {"\tclient := logstack."}
          <Fn>NewClient</Fn>(logstack.Config{"{"}
        </>,
        <>
          {"\t\tAPIKey:      os."}
          <Fn>Getenv</Fn>(<Str>&quot;LOGSTACK_API_KEY&quot;</Str>),
        </>,
        <>
          {"\t\tEnvironment: "}
          <Str>&quot;production&quot;</Str>,
        </>,
        "\t})",
        <>
          {"\t"}
          <Kw>defer</Kw> client.<Fn>Close</Fn>()
        </>,
        "",
        <>
          {"\t"}
          <Cm key="go-comment">
            {"// Checkout service — same structured event"}
          </Cm>
        </>,
        <>
          {"\t"}
          <Kw>return</Kw> client.<Fn>Info</Fn>(ctx,{" "}
          <Str>&quot;User subscribed&quot;</Str>, <Kw>map</Kw>[<Kw>string</Kw>]
          <Kw>interface</Kw>
          {}
          {"{"}
        </>,
        <>
          {"\t\t"}
          <Str>&quot;plan&quot;</Str>: plan,
        </>,
        <>
          {"\t\t"}
          <Str>&quot;revenue&quot;</Str>: <Num>2900</Num>,
        </>,
        <>
          {"\t\t"}
          <Str>&quot;userId&quot;</Str>: userID,
        </>,
        "\t})",
        "}",
      ]}
    />
  );
}

function Snippet({ id }: { id: SdkId }) {
  switch (id) {
    case "node":
      return <NodeSnippet />;
    case "python":
      return <PythonSnippet />;
    case "go":
      return <GoSnippet />;
  }
}

export function InstallLogstack() {
  const [sdk, setSdk] = useState<SdkId>("node");
  const active = SDKS.find((item) => item.id === sdk) ?? SDKS[0];

  return (
    <section
      id="install"
      className="relative z-10 mx-auto w-full min-w-0 max-w-5xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
          SDKs
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Install once. Ship from any runtime.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Drop in the Node, Python, or Go client. All three POST structured
          events to the same ingest path — so checkout, workers, and services
          land in one live stream.
        </p>
      </div>

      <Tabs
        value={sdk}
        onValueChange={(value) => setSdk(value as SdkId)}
        className="mt-10"
      >
        <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-3 border-b border-white/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="hidden items-center gap-1.5 sm:flex"
                aria-hidden="true"
              >
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-green-400/70" />
              </div>
              <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0 sm:w-auto">
                {SDKS.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm"
                  >
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-zinc-500 sm:justify-end sm:text-xs sm:normal-case sm:tracking-normal">
              <span className="inline-flex items-center gap-1.5 truncate">
                <Terminal className="size-3.5 shrink-0" />
                {active.filename}
              </span>
              <span className="hidden sm:inline">{active.runtime}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <code className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-zinc-300 sm:text-[13px]">
              <span className="text-emerald-400">$</span> {active.install}
            </code>
            <CopyButton value={active.install} label="install command" />
          </div>

          {SDKS.map((item) => (
            <TabsContent
              key={item.id}
              value={item.id}
              forceMount
              className="mt-0 data-[state=inactive]:hidden"
            >
              <div className="relative">
                <div className="absolute right-2 top-2 z-10 sm:right-3 sm:top-3">
                  <CopyButton value={SNIPPETS[item.id]} label="snippet" />
                </div>
                <div className="w-full max-w-full overflow-x-auto p-4 pr-12 font-mono text-[12px] leading-relaxed sm:p-6 sm:pr-16 sm:text-[13px]">
                  <Snippet id={item.id} />
                </div>
              </div>
            </TabsContent>
          ))}

          <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-pretty">
              {/* Same event, three runtimes. Ingest path is always POST /v1/logs. */}
              All three runtimes POST structured events to the same ingest path.
            </p>
            <Link
              href={active.docsHref}
              className="text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {active.docsLabel} →
            </Link>
          </div>
        </div>
      </Tabs>
    </section>
  );
}
