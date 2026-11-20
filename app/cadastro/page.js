import Link from "next/link";
import Shell from "../_components/Shell";
import { Icon } from "../_components/icons";
import ReferencesTable from "./ReferencesTable";
import CollectionPicker from "./CollectionPicker";
import { requireModule, canAccess } from "@/lib/auth";
import { CLASSIFICATION_TYPES, listClassificationValues, listReferencesByCollection, sortCollections } from "@/lib/totvs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cadastro de Produtos" };
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
      <header className="page-head">
        <div>
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot" aria-hidden="true" /> Conectado ao TOTVS
          </div>
          <h1 style={{ marginTop: 10 }}>Cadastro de Produtos</h1>
          <p>
            Referências por coleção e suas classificações. Coleções passadas também aparecem, para completar o que faltou.
            {canEdit ? "" : " Seu acesso é só de consulta."}
          </p>
        </div>
        <Link href="/cadastro/classificacoes" className="btn secondary">
          <Icon name="tag" size={16} />
          Famílias e classificações
        </Link>
      </header>

      <div className="stack">
        <CollectionPicker collections={collections} value={collection} />

        {error ? (
          <div className="alert error" role="alert">
            <Icon name="erro" size={16} />
            {error}
          </div>
        ) : null}

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
