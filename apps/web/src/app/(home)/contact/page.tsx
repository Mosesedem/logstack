import { Metadata } from "next";
import { Mail, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contact Us - Logstack",
  description: "Contact Logstack for log management support and sales inquiries",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Contact Us</h1>
        <p className="mt-2 text-zinc-400">
          Have questions about self-hosting, enterprise plans, or SDK integrations?
          We&apos;re here to help.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <Mail className="mb-3 h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-semibold">Technical Support</h2>
          <p className="mt-1 text-sm text-zinc-400">
            For bugs, integration questions, and operational help:
          </p>
          <a
            href="mailto:support@logstack.tech"
            className="mt-3 inline-block font-mono text-sm text-emerald-400 hover:underline"
          >
            support@logstack.tech
          </a>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <MessageSquare className="mb-3 h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-semibold">Sales & Enterprise</h2>
          <p className="mt-1 text-sm text-zinc-400">
            For high-volume custom retention, dedicated nodes, and SLAs:
          </p>
          <a
            href="mailto:sales@logstack.tech"
            className="mt-3 inline-block font-mono text-sm text-emerald-400 hover:underline"
          >
            sales@logstack.tech
          </a>
        </div>
      </div>

      <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-200">Support Hours & SLA</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Our engineering team monitors critical infrastructure 24/7. Standard
          inquiries are answered Monday through Friday within 24 hours.
        </p>
      </div>
    </div>
  );
}
