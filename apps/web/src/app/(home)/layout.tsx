import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";

// The marketing site is always dark. We force it deterministically with a `dark`
// wrapper class (the same pattern the dashboard layout uses) rather than relying
// on next-themes timing — this avoids a light-themed flash and keeps CSS-variable
// components (cards, buttons, borders) consistent with the dark hero. See the
// theme reconciliation note in CLAUDE.md.
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark flex min-h-screen flex-col bg-black text-white selection:bg-emerald-500/20">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
