"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LiveLogTerminal } from "@/components/LiveLogTerminal";

export function LiveProductionStream() {
  return (
    <section
      id="stream"
      className="relative z-10 mx-auto w-full min-w-0 max-w-5xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
          Live stream
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          production.stream, as it happens.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Every structured event your SDKs ship lands on a live WebSocket tail.
          Levels, services, and latency in one stream — the same view you would
          stare at in a local shell, pointed at production.
        </p>
      </div>

      <div className="mt-10 min-w-0">
        <LiveLogTerminal />
      </div>

      <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-pretty">
          Replay of a production checkout. Filter and triage the real stream in
          the dashboard.
        </p>
        <Link
          href="/signup"
          className="inline-flex shrink-0 items-center gap-1 text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Open the live dashboard
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
