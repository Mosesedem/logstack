import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import "./globals.css"; // Your tailwind directives MUST be first
// import "fumadocs-ui/style.css";
import { Providers } from "./providers";

const overpass = Overpass({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Logstack - Log Management Platform",
  description:
    "Production-ready log management with real-time streaming and smart alerts",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={overpass.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
