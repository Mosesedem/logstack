// export default function AuthLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return <div className="min-h-screen bg-muted/30">{children}</div>;
// }

import { ThemeProvider } from "@/components/theme-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider forcedTheme="light">
      <div className="min-h-screen bg-muted/30">{children}</div>
    </ThemeProvider>
  );
}
