import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "One Piece Memory Trainer", template: "%s · One Piece Memory Trainer" },
  description: "Memorise every One Piece Card Game effect with the Bruno/Dicsone memory-palace method. Vivid images, memory paths, drills and spaced repetition.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#07090f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
