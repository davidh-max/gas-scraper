import type { Metadata } from "next";

import "./globals.css";
import { signOut } from "@/lib/actions";

export const metadata: Metadata = {
  title: "GAS — Prospección B2B",
  description: "Panel interno de prospección por delegación (GAS).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="nav">
          <div className="inner">
            <span className="brand">GAS</span>
            <nav>
              <a href="/">Dashboard</a>
              <a href="/jobs/new">Nuevo job</a>
              <a href="/review">Revisar</a>
            </nav>
            <form action={signOut}>
              <button className="btn secondary" type="submit">
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
