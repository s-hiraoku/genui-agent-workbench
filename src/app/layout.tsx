import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
