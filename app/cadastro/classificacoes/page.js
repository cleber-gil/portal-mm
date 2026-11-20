import Link from "next/link";
import Shell from "../../_components/Shell";
import ValueForm from "./ValueForm";
import { Icon } from "../../_components/icons";
import { requireModule, canAccess } from "@/lib/auth";
import { CLASSIFICATION_TYPES, listClassificationValues } from "@/lib/totvs";

export const dynamic = "force-dynamic";

export default async function ClassificacoesPage({ searchParams }) {
  const user = await requireModule("cadastro", "view");
  const canEdit = canAccess(user, "cadastro", "edit");
  const typeCode = Number(searchParams?.tipo || 104);
  const type = CLASSIFICATION_TYPES.find((t) => t.code === typeCode) || CLASSIFICATION_TYPES[4];

  let values = null;
  let error = "";
  try {
    values = await listClassificationValues();
  } catch (e) {
    error = e.message || String(e);
  }
  const list = values?.[type.code] || [];

  return (
    <Shell user={user} active="cadastro">
      <div className="stack">
        <div>
          <Link href="/cadastro" className="btn ghost" style={{ paddingLeft: 0 }}>
            <Icon name="voltar" size={16} /> Cadastro de Produtos
          </Link>
          <h1 style={{ marginTop: 8 }}>Famílias e classificações</h1>
          <p className="text-2" style={{ marginTop: 6 }}>
            Valores cadastrados no TOTVS para cada tipo. Nomes são gravados em maiúsculas e sem acento.
          </p>
        </div>

        <div className="nav" role="tablist">
          {CLASSIFICATION_TYPES.map((t) => (
            <Link key={t.code} href={`/cadastro/classificacoes?tipo=${t.code}`} className={t.code === type.code ? "active" : ""}>
              {t.code} {t.name}
            </Link>
          ))}
        </div>

        {error ? <div className="alert error">{error}</div> : null}

        {canEdit ? (
          <div className="panel stack">
            <h2>Novo valor em {type.name}</h2>
            <ValueForm typeCode={type.code} />
            <span className="muted small">O código é gerado automaticamente na sequência dos existentes.</span>
          </div>
        ) : null}

        <div className="table-wrap" style={{ maxHeight: "none" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Código</th>
                <th>Nome {canEdit ? "(edite e clique em Renomear)" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.code}>
                  <td>
                    <span className="mono" style={{ fontWeight: 500 }}>{v.code}</span>
                  </td>
                  <td>{canEdit ? <ValueForm typeCode={type.code} value={v} compact /> : v.name}</td>
                </tr>
              ))}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={2} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    Nenhum valor cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
