import Link from "next/link";
import Shell from "../../_components/Shell";
import { Icon } from "../../_components/icons";
import ImportForm from "./ImportForm";
import { requireModule } from "@/lib/core/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Importar famílias" };

export default async function ImportarPage() {
  const user = await requireModule("cadastro", "edit");
  return (
    <Shell user={user} active="cadastro">
      <div className="stack">
        <div>
          <Link href="/cadastro" className="btn ghost" style={{ paddingLeft: 0 }}>
            <Icon name="voltar" size={16} /> Cadastro de Produtos
          </Link>
          <h1 style={{ marginTop: 8 }}>Importar famílias</h1>
          <p className="text-2" style={{ marginTop: 6, maxWidth: "65ch" }}>
            Grava a família (classificação 104) nas referências do TOTVS a partir da planilha de controle da coleção. Simule primeiro: nada é gravado até
            você confirmar.
          </p>
        </div>
        <ImportForm />
      </div>
    </Shell>
  );
}
