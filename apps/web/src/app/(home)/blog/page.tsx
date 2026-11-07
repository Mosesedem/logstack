import Link from "next/link";

export default function BlogPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Blog</h1>
      <p className="mb-8 text-zinc-400">
        Engineering deep-dives, architecture notes, and release updates.
      </p>
      <p className="text-sm text-zinc-500">
        In the meantime, follow the{" "}
        <Link href="/changelog" className="text-emerald-400 hover:underline">
          changelog
        </Link>{" "}
        or explore the{" "}
        <Link href="/docs" className="text-emerald-400 hover:underline">
          documentation
        </Link>
        .
      </p>
    </div>
  );
}
