import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy - Logstack",
  description: "Cookie policy for Logstack log management platform",
};

export default function CookiePolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-4xl font-bold tracking-tight">Cookie Policy</h1>
        <p className="text-zinc-400">Last updated: May 6, 2026</p>

        <h2 className="mt-8 text-xl font-semibold">1. What Are Cookies</h2>
        <p className="text-zinc-300">
          Cookies and local storage tokens are small data items stored on your device
          to maintain your authenticated session and preserve user preferences.
        </p>

        <h2 className="mt-8 text-xl font-semibold">2. How We Use Cookies</h2>
        <p className="text-zinc-300">Logstack uses strictly functional cookies to:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-300">
          <li>Maintain secure authentication sessions across page navigations</li>
          <li>Preserve your active project selection in the dashboard</li>
          <li>Remember your theme and interface preferences</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">3. Third-Party Trackers</h2>
        <p className="text-zinc-300">
          We do not sell telemetry data to third parties or use third-party cross-site
          tracking cookies.
        </p>
      </div>
    </div>
  );
}
