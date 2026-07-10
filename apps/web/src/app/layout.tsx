import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const overpass = Overpass({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://logstack.tech",
  ),
  title: "Logstack - Log Management Platform",
  description:
    "Production-ready log management with real-time streaming and smart alerts",
  applicationName: "Logstack",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "1024x1024" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Logstack - Log Management Platform",
    description:
      "Production-ready log management with real-time streaming and smart alerts",
    siteName: "Logstack",
    images: [{ url: "/android-chrome-512x512.png", width: 512, height: 512, alt: "Logstack" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Logstack - Log Management Platform",
    description:
      "Production-ready log management with real-time streaming and smart alerts",
    images: ["/android-chrome-512x512.png"],
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
