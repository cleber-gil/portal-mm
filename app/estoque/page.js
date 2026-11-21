import Shell from "../_components/Shell";
import EstoqueView from "./EstoqueView";
import { requireModule } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import { BRANCHES } from "@/lib/config/branches";
import "./estoque.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estoque" };

// ?aba=lojas|matriz|consignacao|condicional e ?loja=<código> abrem a tela já filtrada (atalhos da tela inicial)
const ABAS = { lojas: "stores", matriz: "matrix", consignacao: "consignment", condicional: "conditional" };

export default async function EstoquePage({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  const user = await requireModule("estoque", "view");
  const allowed = visibleBranches(user); // null = todas
  const branches = allowed === null ? BRANCHES : BRANCHES.filter((b) => allowed.includes(b.code));
  return (
    <Shell user={user} active="estoque">
      <EstoqueView
        branches={branches}
        restricted={allowed !== null}
        canMatrix={allowed === null || allowed.includes(1)}
        initialView={ABAS[searchParams?.aba] || "stores"}
        initialBranch={searchParams?.loja || ""}
      />
    </Shell>
  );
}
