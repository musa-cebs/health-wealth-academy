import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Instrument_Sans, Bricolage_Grotesque } from "next/font/google";
import Shell from "@/components/Shell";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = { title: "Health & Wealth Academy", description: "The Health & Wealth Distributor Training System" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${body.variable} ${display.variable}`}>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
