import type { Metadata } from "next";
import "./globals.css";
import { ThemeBoot } from "./ThemeBoot";

export const metadata: Metadata = {
  title: "GenUI Popup Broker",
  description:
    "A resident GenUI broker that lets AI agents open generated UI through CLI and MCP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}
