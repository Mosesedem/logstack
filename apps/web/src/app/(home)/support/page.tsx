import Link from "next/link";
import { Mail, MessageCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SupportPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Support</h1>
      <p className="mb-12 text-zinc-400">
        Need help setting up Logstack or managing your deployment? We&apos;re here for you.
      </p>

      <div className="grid gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <BookOpen className="mb-3 h-6 w-6 text-emerald-400" />
          <h2 className="mb-2 text-lg font-semibold">Documentation</h2>
          <p className="mb-4 text-sm text-zinc-400">
            SDK guides, API reference, and deployment configurations.
          </p>
          <Button variant="outline" asChild>
            <Link href="/docs">Browse docs</Link>
          </Button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <Mail className="mb-3 h-6 w-6 text-emerald-400" />
          <h2 className="mb-2 text-lg font-semibold">Email support</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Reach out directly to our engineering team for technical inquiries.
          </p>
          <Button variant="outline" asChild>
            <a href="mailto:support@logstack.tech">support@logstack.tech</a>
          </Button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <MessageCircle className="mb-3 h-6 w-6 text-emerald-400" />
          <h2 className="mb-2 text-lg font-semibold">Community</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Open an issue, report a bug, or participate in discussions on GitHub.
          </p>
          <Button variant="outline" asChild>
            <a
              href="https://github.com/mosesedem/logstack/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Issues
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
