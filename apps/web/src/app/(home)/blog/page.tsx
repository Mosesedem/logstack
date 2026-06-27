import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";

export default function BlogPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <Navbar />
      <div className="relative z-10 container mx-auto px-4 pt-32 pb-20 max-w-3xl text-center">
        <h1 className="text-4xl font-bold mb-4">Blog</h1>
        <p className="text-zinc-400 mb-8">
          Engineering posts and product updates are coming soon.
        </p>
        <p className="text-sm text-zinc-500">
          In the meantime, follow the{" "}
          <Link href="/changelog" className="text-primary hover:underline">
            changelog
          </Link>{" "}
          or read the{" "}
          <Link href="/docs" className="text-primary hover:underline">
            documentation
          </Link>
          .
        </p>
      </div>
    </div>
  );
}