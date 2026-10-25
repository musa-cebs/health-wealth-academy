import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";

export const metadata: Metadata = { title: "Health & Wealth Academy", description: "The Health & Wealth Distributor Training System" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
