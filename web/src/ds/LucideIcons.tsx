"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Los componentes del DS pintan iconos como `<i data-lucide="...">`. Lucide trae un
// `createIcons()` que SUSTITUYE cada <i> por un <svg> en el DOM — pero eso rompe a React:
// cuando React desmonta un árbol (p. ej. al navegar tras "Lanzar lote") intenta
// `removeChild` del <i> que ya no existe (es un <svg>) → "Failed to execute 'removeChild'".
//
// Solución: NO reemplazamos el <i>. Renderizamos el <svg> como HIJO del <i> (que React
// sigue siendo dueño y siempre es un hijo real de su padre). Así removeChild nunca falla.
// El <svg> es invisible para React (no lo creó), así que no lo toca en sus reconciliaciones.
declare global {
  interface Window {
    lucide?: {
      createIcons: () => void;
      createElement: (iconNode: unknown) => SVGElement;
      icons?: Record<string, unknown>;
    };
  }
}

const DONE_ATTR = "data-lucide-rendered";

// "chevron-up" → "ChevronUp", "building-2" → "Building2", "log-out" → "LogOut".
function toPascal(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function renderIcons(): void {
  const lucide = typeof window !== "undefined" ? window.lucide : undefined;
  if (!lucide?.icons || typeof lucide.createElement !== "function") return;

  for (const el of document.querySelectorAll<HTMLElement>("[data-lucide]")) {
    const name = el.getAttribute("data-lucide") ?? "";
    if (el.getAttribute(DONE_ATTR) === name) continue; // ya pintado para este nombre

    const iconNode = lucide.icons[toPascal(name)];
    if (!iconNode) continue; // icono desconocido → no rompemos, lo dejamos vacío

    let svg: SVGElement;
    try {
      svg = lucide.createElement(iconNode);
    } catch {
      continue;
    }
    svg.style.display = "block";
    if (el.style.width) svg.style.width = el.style.width;
    if (el.style.height) svg.style.height = el.style.height;

    // el <i> pasa a ser una caja inline-flex del tamaño que ya tenía; el svg la rellena.
    el.style.display = "inline-flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.lineHeight = "0";
    el.replaceChildren(svg);
    el.setAttribute(DONE_ATTR, name);
  }
}

export function LucideIcons() {
  const pathname = usePathname();

  // Repinta al montar y en cada cambio de ruta.
  useEffect(() => {
    renderIcons();
  }, [pathname]);

  // Caza iconos nuevos o renombrados (polling del progreso, toggles, escrituras
  // optimistas). Observamos childList + el atributo data-lucide; rAF coalesce ráfagas.
  // renderIcons es idempotente (guarda DONE_ATTR), así que el observer se aquieta solo.
  useEffect(() => {
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        renderIcons();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-lucide"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Script src="https://unpkg.com/lucide@latest" strategy="afterInteractive" onLoad={renderIcons} />
  );
}
