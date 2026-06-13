// app/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logstack } from "@/lib/logger";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // You can log the error to your error tracking service here
    console.error("Global error boundary caught:", error);

    // Optional: send to logging service
    logstack.error("Global error boundary caught", { error: error.message });
  }, [error]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden selection:bg-primary/20 px-4">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-red-500/10 blur-[120px]" />
      </div>

      {/* Grid Pattern */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full text-center space-y-8 py-12">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={40} className="text-red-500" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
          Something went wrong
        </h1>

        <div className="space-y-4">
          <p className="text-lg text-zinc-400">
            We're sorry — an unexpected error occurred.
          </p>

          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-left font-mono text-sm overflow-auto max-h-60">
              <p className="font-semibold text-red-400 mb-2">
                Error details (dev only):
              </p>
              <pre className="text-red-300/80 whitespace-pre-wrap break-words">
                {error.message}
              </pre>
              {error.digest && (
                <p className="mt-3 text-xs text-zinc-500">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
          <Button
            onClick={reset}
            size="lg"
            className="bg-white text-black hover:bg-zinc-200"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900"
          >
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </div>

        <p className="text-sm text-zinc-500 pt-8">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
