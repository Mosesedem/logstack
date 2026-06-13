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
  return <div className="dark">{children}</div>;
}
