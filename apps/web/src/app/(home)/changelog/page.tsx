import Link from "next/link";

const ENTRIES = [
  {
    date: "2026-11-07",
    title: "The usage card is your account menu",
    items: [
      "The meter at the bottom of the dashboard sidebar still shows this month’s log quota. It is also the account button: your email, Link mobile app, Settings, Billing, and Sign out.",
      "Link mobile app opens a QR code and a one-time PIN. The iOS and Android app uses that to sign in, then receives push alerts and the same live log stream as the dashboard.",
      "Sign-in, sign-up, password reset, and Change Password in Settings can show or hide the password. The SDK Demo API key field can too.",
      "Email sign-up sends a confirmation link. Google and GitHub are on the same sign-in page.",
    ],
  },
  {
    date: "2026-06-27",
    title: "Nigeria pays in naira. Everywhere else pays in dollars.",
    items: [
      "Choose a country in Settings. Checkout uses that country.",
      "Nigeria is billed in NGN through Paystack. Every other country in the list is billed in USD through Polar.",
      "Billing shows the plan and its invoices. The sidebar meter turns yellow at 80% of the monthly log quota and red when the quota is used up. From there the account menu offers Upgrade plan.",
    ],
  },
  {
    date: "2026-06-13",
    title: "Send a log, watch it arrive, get notified",
    items: [
      "Each project has an API key. The JavaScript, Go, and Python SDKs post logs to https://api.logstack.tech with that key. The JavaScript SDK can also forward console output.",
      "Logs lists what is stored for the selected project and keeps a WebSocket stream open so new lines show up while you watch.",
      "An alert starts from a minimum level, from debug up to fatal. You can also require a text pattern. A match sends email, a mobile push, or a webhook, then waits out the cooldown before it can send again.",
      "SDK Demo lets you paste a project key, send sample logs, and fire a test alert before you install an SDK. On a paid plan, Team emails an invite so someone else can join the organization.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Changelog</h1>
      <p className="mb-12 text-zinc-400">
        What shipped in Logstack. Setup steps live in the{" "}
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
            <time className="font-mono text-sm text-zinc-500" dateTime={entry.date}>
              {entry.date}
            </time>
            <h2 className="mb-3 mt-1 text-xl font-semibold">{entry.title}</h2>
            <ul className="list-disc space-y-2 pl-5 text-zinc-300">
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
