"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import MavelyWizard from "@/components/MavelyWizard";
import { rowToInput } from "@/lib/mavely-types";
import type { MavelyProductInput } from "@/lib/mavely-types";

export default function EditMavelyProduct() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<MavelyProductInput | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/mavely/products/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setInitial(rowToInput(data.item));
      })
      .catch(() => setError("Could not load this product."));
  }, [params.id]);

  return (
    <AppShell>
      <div className="top">
        <div>
          <div className="eyebrow">Mavely Affiliate Importer</div>
          <h1 className="title">Edit affiliate product</h1>
          <div className="muted">Changes here update the existing Shopify product — a new one is never created.</div>
        </div>
      </div>
      {error && <div className="status">{error}</div>}
      {initial ? <MavelyWizard existingId={params.id} initial={initial} /> : !error && <div className="card">Loading…</div>}
    </AppShell>
  );
}
