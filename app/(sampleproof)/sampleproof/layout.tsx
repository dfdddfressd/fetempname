import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sampleproof",
  description: "Pre-submission sample ledger for enhanced rock weathering. Harmonize lab files, flag gaps, and export a registry-shaped dataset.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
