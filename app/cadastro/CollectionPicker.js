"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// troca de coleção já ao selecionar; mostra "Carregando…" enquanto o TOTVS responde
export default function CollectionPicker({ collections, value }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="row">
      <label className="field" style={{ minWidth: 280 }}>
        <span>Coleção</span>
        <select
          defaultValue={value}
          disabled={pending}
          onChange={(e) => start(() => router.push(`/cadastro?colecao=${encodeURIComponent(e.target.value)}`))}
        >
          {collections.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </label>
      {pending ? (
        <span className="small text-2" style={{ paddingBottom: 10 }} aria-live="polite">
          Buscando referências no TOTVS…
        </span>
      ) : null}
    </div>
  );
}
