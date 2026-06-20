import { NextResponse } from "next/server";

import type { JobRow } from "@/types/db";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const runtime = "edge";

// Descarga el Excel del job desde Storage (bucket privado `resultados`).
// Requiere sesión (middleware) y la policy de storage para `authenticated`.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { createClient } = await import("@/lib/supabaseServer");
  const supabase = await createClient();

  const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
  const job = data as JobRow | null;
  if (!job?.result_path) {
    return new NextResponse("Resultado no disponible.", { status: 404 });
  }

  const { data: file, error } = await supabase.storage.from("resultados").download(job.result_path);
  if (error || !file) {
    return new NextResponse("No se pudo descargar el resultado.", { status: 500 });
  }

  const buffer = await file.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "content-type": XLSX_MIME,
      "content-disposition": `attachment; filename="GAS_${id.slice(0, 8)}.xlsx"`,
    },
  });
}
