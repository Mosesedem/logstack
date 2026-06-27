import Link from "next/link";
import { Mail, MessageCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/marketing/Navbar";

export default function SupportPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <Navbar />
      <div className="relative z-10 container mx-auto px-4 pt-32 pb-20 max-w-3xl">
        <h1 className="text-4xl font-bold mb-4">Support</h1>
        <p className="text-zinc-400 mb-12">
          Need help with Logstack? We&apos;re here for you.
        </p>

        <div className="grid gap-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <BookOpen className="h-6 w-6 text-primary mb-3" />
            <h2 className="text-lg font-semibold mb-2">Documentation</h2>
            <p className="text-zinc-400 text-sm mb-4">
              SDK guides, API reference, and deployment docs.
            </p>
            <Button variant="outline" asChild>
              <Link href="/docs">Browse docs</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <Mail className="h-6 w-6 text-primary mb-3" />
            <h2 className="text-lg font-semibold mb-2">Email support</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Paid plan customers get priority email support.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@logstack.io">support@logstack.io</a>
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <MessageCircle className="h-6 w-6 text-primary mb-3" />
            <h2 className="text-lg font-semibold mb-2">Community</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Open an issue or discussion on GitHub.
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
    </div>
  );
}