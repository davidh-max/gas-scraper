"use client";

import { useState, useTransition } from "react";

import { updateContactStatus } from "@/lib/actions";
import type { ContactRow } from "@/types/db";

export function ReviewRow({
  contact,
  companyName,
}: {
  contact: ContactRow;
  companyName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"approved" | "discarded" | null>(null);

  function act(status: "approved" | "discarded") {
    startTransition(async () => {
      await updateContactStatus(contact.id, status);
      setDone(status);
    });
  }

  if (done) {
    return (
      <tr style={{ opacity: 0.5 }}>
        <td colSpan={6} className="small">
          {contact.first_name} {contact.last_name} → <strong>{done}</strong>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{companyName}</td>
      <td>
        {contact.first_name} {contact.last_name}
      </td>
      <td>{contact.title}</td>
      <td>
        <span className={`badge ${contact.classification}`}>{contact.classification}</span>
        {contact.verify_flag && <span className="badge" style={{ marginLeft: 6 }}>{contact.verify_flag}</span>}
      </td>
      <td>
        {contact.linkedin_url ? (
          <a href={contact.linkedin_url} target="_blank" rel="noreferrer">
            perfil
          </a>
        ) : (
          "—"
        )}
      </td>
      <td>
        <div className="row">
          <button className="btn ok" disabled={pending} onClick={() => act("approved")}>
            Aprobar
          </button>
          <button className="btn danger" disabled={pending} onClick={() => act("discarded")}>
            Descartar
          </button>
        </div>
      </td>
    </tr>
  );
}
