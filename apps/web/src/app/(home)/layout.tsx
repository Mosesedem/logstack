// export default function HomeLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return <>{children}</>;
// }

import { ThemeProvider } from "@/components/theme-provider";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider forcedTheme="light">{children}</ThemeProvider>;
}
