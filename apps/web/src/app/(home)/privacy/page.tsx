import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Logstack",
  description: "Privacy policy for Logstack log management platform",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-zinc-400">Last updated: May 6, 2026</p>

        <h2 className="mt-8 text-xl font-semibold">1. Information We Collect</h2>
        <p className="text-zinc-300">We collect information necessary to operate your logging infrastructure:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-300">
          <li>Account details (email address and name) when you create an account</li>
          <li>Payment information processed securely via our billing providers (Paystack or Polar)</li>
          <li>Telemetry data, error logs, and project metadata ingested via our SDKs</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">2. How We Use Your Information</h2>
        <p className="text-zinc-300">We use the collected information exclusively to:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-300">
          <li>Ingest, index, and stream logs to your dashboard</li>
          <li>Evaluate alert rules and dispatch notifications (email, push)</li>
          <li>Meter billing usage and enforce plan limits</li>
          <li>Respond to technical support and infrastructure requests</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">3. Data Security & Storage</h2>
        <p className="text-zinc-300">
          All data in transit is encrypted using modern TLS (HTTPS/WSS). Log
          storage is protected by role-based access control and isolated by organization.
          Data retention policies automatically prune expired telemetry according to your
          configured plan.
        </p>

        <h2 className="mt-8 text-xl font-semibold">4. Your Rights</h2>
        <p className="text-zinc-300">
          You may access, export, or permanently delete your account data,
          projects, and stored logs at any time from your dashboard or by
          contacting support@logstack.tech.
        </p>
      </div>
    </div>
  );
}
