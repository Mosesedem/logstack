// app/not-found.tsx
"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchX, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden selection:bg-primary/20">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      {/* Grid Pattern */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative z-10 text-center space-y-8 max-w-xl px-4">
        {/* Visual + Status */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
          <SearchX size={40} className="text-zinc-500" />
        </div>

        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Page not found
          </h2>

          <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
            Sorry, we couldn’t find the page you’re looking for. It may have
            been moved, renamed, or doesn’t exist.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className="bg-white text-black hover:bg-zinc-200"
          >
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to homepage
            </Link>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            className="border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
        </div>

        {/* Helpful links / reassurance */}
        <div className="pt-8 border-t border-zinc-900 mt-8">
          <p className="text-sm text-zinc-500 mb-4">
            Looking for something else?
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-400">
            <Link href="/docs" className="hover:text-primary transition-colors">
              Documentation
            </Link>
            <Link
              href="/login"
              className="hover:text-primary transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="hover:text-primary transition-colors"
            >
              Signup
            </Link>
            <Link
              href="/pricing"
              className="hover:text-primary transition-colors"
            >
              Pricing
            </Link>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="absolute bottom-6 text-xs text-zinc-600">
        LogStack • {new Date().getFullYear()}
      </div>
    </div>
  );
}

// Optional: better SEO for 404 pages
// export const metadata = {
//   title: "404 - Page Not Found",
//   description: "The page you are looking for does not exist or has been moved.",
//   robots: {
//     index: false,
//     follow: false,
//   },
// };
