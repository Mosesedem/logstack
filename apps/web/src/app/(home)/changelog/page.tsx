import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";

const ENTRIES = [
  {
    date: "2026-06-27",
    title: "Dual billing: Paystack + Polar",
    items: [
      "Nigerian customers billed in NGN via Paystack subscriptions",
      "International customers billed in USD via Polar",
      "Settings page: country selector drives billing region",
    ],
  },
  {
    date: "2026-06-13",
    title: "Logstack v1 stabilization",
    items: [
      "Real-time logs viewer with WebSocket streaming",
      "SDK ingest path fixes across JS, Go, and Python",
      "Forced-dark landing and auth pages",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <Navbar />
      <div className="relative z-10 container mx-auto px-4 pt-32 pb-20 max-w-3xl">
        <h1 className="text-4xl font-bold mb-4">Changelog</h1>
        <p className="text-zinc-400 mb-12">
          What&apos;s new in Logstack. Also see{" "}
          <Link href="/docs" className="text-primary hover:underline">
            docs
          </Link>
          .
        </p>

        <div className="space-y-10">
          {ENTRIES.map((entry) => (
            <article
              key={entry.date}
              className="border-b border-white/10 pb-10 last:border-0"
            >
              <time className="text-sm text-zinc-500">{entry.date}</time>
              <h2 className="text-xl font-semibold mt-1 mb-3">{entry.title}</h2>
              <ul className="list-disc list-inside space-y-1 text-zinc-400">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}