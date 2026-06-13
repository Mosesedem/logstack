// Auth screens follow the dark product theme. Forced deterministically via a
// `dark` wrapper class (matching the landing and dashboard layouts) to avoid a
// light-themed flash on first paint.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark">
      <div className="min-h-screen bg-muted/30">{children}</div>
    </div>
  );
}
