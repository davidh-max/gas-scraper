import { ReviewRow, REVIEW_COLUMNS } from "@/components/ReviewRow";
import { getDataSource } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const contacts = await getDataSource().getReviewContacts();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, font: "var(--weight-bold) 30px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
          Bandeja de revisar
        </h1>
        <p style={{ margin: "6px 0 0", font: "var(--weight-medium) 14px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
          Contactos dudosos. Aprueba o descarta en línea — nunca se borra a nadie, solo cambia el estado.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        {/* top bar */}
        <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 26px", borderBottom: "1px solid var(--border-subtle)" }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "var(--amber-100)",
              color: "#9A6A00",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i data-lucide="inbox" style={{ width: 21, height: 21 }} />
          </span>
          <div>
            <h2 style={{ margin: 0, font: "var(--weight-bold) 22px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
              Revisar
            </h2>
            <div style={{ font: "var(--weight-medium) 13px/1 var(--font-sans)", color: "var(--text-secondary)", marginTop: 3 }}>
              Validación humana de los contactos clasificados como «revisar».
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                borderRadius: 999,
                background: "var(--amber-100)",
                color: "#9A6A00",
                font: "var(--weight-bold) 13px/1 var(--font-tech)",
              }}
            >
              <i data-lucide="search-check" style={{ width: 15, height: 15 }} /> {contacts.length} pendientes
            </span>
          </div>
        </header>

        {contacts.length === 0 ? (
          <div style={{ padding: "40px 26px", textAlign: "center", color: "var(--text-muted)", font: "var(--weight-medium) 14px/1.5 var(--font-sans)" }}>
            No hay contactos pendientes de revisión. ✨
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: REVIEW_COLUMNS,
                gap: 14,
                padding: "12px 26px",
                background: "var(--neutral-50)",
                borderBottom: "1px solid var(--border-subtle)",
                font: "var(--weight-bold) 10px/1.2 var(--font-tech)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <div>Contacto</div>
              <div>Cargo</div>
              <div>Empresa</div>
              <div>Motivo de revisión</div>
              <div style={{ textAlign: "right" }}>Acción</div>
            </div>
            {contacts.map((contact) => (
              <ReviewRow key={contact.id} contact={contact} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
