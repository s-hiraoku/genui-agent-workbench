import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeBoot } from "./ThemeBoot";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono-src",
});

export const metadata: Metadata = {
  title: "GenUI Popup Broker",
  description:
    "A resident GenUI broker that lets AI agents open OpenUI Lang popups through the CLI.",
  icons: {
    icon: "/favicon.svg",
  },
};

const noFlash = `
  (() => {
    try {
      const c = new URLSearchParams(location.search).get("chrome");
      if (c) document.documentElement.dataset.chrome = c;
    } catch {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={jetbrains.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body>
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}
