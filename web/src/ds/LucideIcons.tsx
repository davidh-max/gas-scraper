"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Los componentes del DS pintan iconos como `<i data-lucide="...">` y dependen
// del global `lucide.createIcons()` para convertirlos en SVG. Este runner:
//   1. carga Lucide desde el CDN,
//   2. re-ejecuta createIcons en cada navegación, y
//   3. observa el DOM para cazar iconos insertados dinámicamente (polling del
//      progreso, escrituras optimistas, toggles), con debounce por frame.
declare global {
  interface Window {
    lucide?: { createIcons: () => void };
  }
}

function runIcons(): void {
  if (typeof window !== "undefined" && window.lucide) window.lucide.createIcons();
}

export function LucideIcons() {
  const pathname = usePathname();

  // En cada cambio de ruta (y al montar) repinta los iconos del nuevo árbol.
  useEffect(() => {
    runIcons();
  }, [pathname]);

  // createIcons sustituye <i> por <svg> (sin data-lucide), así que un segundo
  // pase es idempotente y el observer se aquieta. rAF coalesce ráfagas.
  useEffect(() => {
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        runIcons();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <Script src="https://unpkg.com/lucide@latest" strategy="afterInteractive" onLoad={runIcons} />
  );
}
