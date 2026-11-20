import Link from "next/link";
import Shell from "../_components/Shell";
import ReferencesTable from "./ReferencesTable";
import { requireModule, canAccess } from "@/lib/auth";
import { CLASSIFICATION_TYPES, listClassificationValues, listReferencesByCollection, sortCollections } from "@/lib/totvs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function CadastroPage({ searchParams }) {
  const user = await requireModule("cadastro", "view");
  const canEdit = canAccess(user, "cadastro", "edit");

  let values = null;
  let refs = [];
  let error = "";
  let collections = [];
  let collection = searchParams?.colecao || "";
  try {
    values = await listClassificationValues();
    collections = sortCollections(values[103] || []);
    if (!collection && collections.length) collection = collections[0].code;
    if (collection) refs = await listReferencesByCollection(collection);
  } catch (e) {
    error = e.message || String(e);
  }
  const current = collections.find((c) => c.code === collection);

  return (
    <Shell user={user} active="cadastro">
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>Cadastro de Produtos</h1>
            <p className="muted" style={{ margin: 0 }}>
              Referências por coleção e suas classificações no TOTVS. {canEdit ? "" : "Seu acesso é só de consulta."}
            </p>
          </div>
          <Link href="/cadastro/classificacoes" className="btn secondary">
            Famílias e classificações
          </Link>
        </div>

        <form className="card row" method="get">
          <label style={{ minWidth: 260 }}>
            Coleção
            <select name="colecao" defaultValue={collection}>
              {collections.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">
            Abrir
          </button>
          <span className="muted small">Inclui coleções passadas para completar informações.</span>
        </form>

        {error ? <div className="alert error">{error}</div> : null}

        {!error && collection ? (
          <ReferencesTable
            key={collection}
            collection={{ code: collection, name: current?.name || "" }}
            refs={refs}
            types={CLASSIFICATION_TYPES}
            values={values}
            canEdit={canEdit}
          />
        ) : null}
      </div>
    </Shell>
  );
}
