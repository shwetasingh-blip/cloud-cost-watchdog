import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%230071E3'/%3E%3Ccircle cx='50' cy='50' r='28' fill='none' stroke='white' stroke-width='8'/%3E%3Cpath d='M50 32 L50 52 L64 60' stroke='white' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Cloud Cost Watchdog",
  description: "Catch cloud and AI spend spikes before they burn your runway.",
  icons: { icon: favicon },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
