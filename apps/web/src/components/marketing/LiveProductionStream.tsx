"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LiveLogTerminal } from "@/components/LiveLogTerminal";

export function LiveProductionStream() {
  return (
    <section
      id="stream"
      className="relative z-10 mx-auto w-full min-w-0 max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-20 lg:py-24"
    >
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Live Stream
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-5xl">
            production.stream, as it happens.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Every structured event your SDKs ship lands on a live WebSocket tail.
            Filter and inspect production telemetry in real time — the exact same
            view as your authenticated dashboard.
          </p>
        </div>

        <Link
          href="/signup"
          className="inline-flex w-full sm:w-auto items-center justify-center shrink-0 gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-medium text-white transition-all hover:border-zinc-500 hover:bg-zinc-800"
        >
          <span>Open live dashboard</span>
          <ArrowRight className="size-3.5 sm:size-4 text-emerald-400" />
        </Link>
      </div>

      <div className="mt-8 min-w-0">
        <LiveLogTerminal />
      </div>
    </section>
  );
}
