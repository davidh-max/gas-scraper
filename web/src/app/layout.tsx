import type { Metadata } from "next";

import "@/ds/styles.css"; // tokens + webfonts del GAS Design System
import "./globals.css";
import { LucideIcons } from "@/ds/LucideIcons";

export const metadata: Metadata = {
  title: "SCRAPER · GAS",
  description: "Prospección B2B por delegación — interfaz interna de GAS.",
  icons: { icon: "/gas-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <LucideIcons />
      </body>
    </html>
  );
}
