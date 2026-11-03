import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QRCraft — a scannable medieval kingdom",
  description:
    "Turn a URL, message, or QR image into a deterministic Minecraft-style medieval kingdom whose real top projection is a working QR code.",
  applicationName: "QRCraft",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1511",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
