import type { Metadata, Viewport } from "next";
import "./verbon.css";

export const metadata: Metadata = {
  title: "Verbon",
  description:
    "Field workflow for independent carbon verifiers: capture plots, run CAR's sequential sampling test live, and reconcile against the developer's data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F1A13",
};

export default function VerbonLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
