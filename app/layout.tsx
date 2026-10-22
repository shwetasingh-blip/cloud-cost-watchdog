import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ResourcesProvider } from "@/contexts/ResourcesContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%232563EB'/%3E%3Cpath d='M20 60 L38 42 L52 54 L80 26' stroke='white' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "BurnWatch",
  description: "Catch cloud and AI spend spikes before they burn your runway.",
  icons: { icon: favicon },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="aurora" aria-hidden="true">
          <span className="aurora__blob aurora__blob--teal" />
          <span className="aurora__blob aurora__blob--violet" />
          <span className="aurora__blob aurora__blob--rose" />
        </div>
        <ResourcesProvider>{children}</ResourcesProvider>
      </body>
    </html>
  );
}
