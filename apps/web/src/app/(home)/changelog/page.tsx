import Link from "next/link";

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
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Changelog</h1>
      <p className="mb-12 text-zinc-400">
        What&apos;s new in Logstack. Also see{" "}
        <Link href="/docs" className="text-emerald-400 hover:underline">
          documentation
        </Link>
        .
      </p>

      <div className="space-y-10">
        {ENTRIES.map((entry) => (
          <article
            key={entry.date}
            className="border-b border-zinc-800 pb-10 last:border-0"
          >
            <time className="text-sm font-mono text-zinc-500">{entry.date}</time>
            <h2 className="mt-1 mb-3 text-xl font-semibold">{entry.title}</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
