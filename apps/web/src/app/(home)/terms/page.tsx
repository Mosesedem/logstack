import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Logstack",
  description: "Terms of service for Logstack log management platform",
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-zinc-400">Last updated: May 6, 2026</p>

        <h2 className="mt-8 text-xl font-semibold">1. Acceptance of Terms</h2>
        <p className="text-zinc-300">
          By accessing or using Logstack, you agree to be bound by these Terms
          of Service and all applicable laws and regulations. If you do not agree
          with any of these terms, you are prohibited from using this service.
        </p>

        <h2 className="mt-8 text-xl font-semibold">2. Use License & Account Responsibility</h2>
        <p className="text-zinc-300">
          You are responsible for safeguarding your API keys, credentials, and
          controlling access to your projects. Logstack grants you a limited,
          non-exclusive license to use the service in accordance with your chosen
          plan limits.
        </p>

        <h2 className="mt-8 text-xl font-semibold">3. Service Availability & Limits</h2>
        <p className="text-zinc-300">
          While we strive for maximum uptime, services are provided &quot;as is&quot;
          without warranty of any kind. High-throughput ingestion is subject to
          the rate limits and retention policies associated with your subscription tier.
        </p>

        <h2 className="mt-8 text-xl font-semibold">4. Data Ownership & Privacy</h2>
        <p className="text-zinc-300">
          You retain full ownership of all telemetry data and log payloads
          transmitted to Logstack. We process and store this data solely to provide
          the logging, alerting, and analysis services requested.
        </p>

        <h2 className="mt-8 text-xl font-semibold">5. Modifications to Terms</h2>
        <p className="text-zinc-300">
          We may revise these terms of service at any time by updating this
          page. Continued use of the platform after changes constitutes acceptance
          of the updated terms.
        </p>

        <h2 className="mt-8 text-xl font-semibold">6. Governing Law</h2>
        <p className="text-zinc-300">
          These terms and conditions are governed by and construed in accordance
          with applicable commercial laws in the jurisdiction of Logstack&apos;s operation.
        </p>
      </div>
    </div>
  );
}
