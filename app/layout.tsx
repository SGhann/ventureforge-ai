import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VentureForge AI — From Ideation to IPO",
  description:
    "Eleven specialist AI agents that carry your venture's context from first idea to IPO. Market research, financial modeling, legal, fundraising, marketing — grounded in what they actually know about your business.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
