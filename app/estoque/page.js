import Shell from "../_components/Shell";
import EstoqueView from "./EstoqueView";
import { requireModule } from "@/lib/auth";
import { visibleBranches } from "@/lib/access";
import { BRANCHES } from "@/lib/branches";
import "./estoque.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estoque" };

export default async function EstoquePage() {
  const user = await requireModule("estoque", "view");
  const allowed = visibleBranches(user); // null = todas
  const branches = allowed === null ? BRANCHES : BRANCHES.filter((b) => allowed.includes(b.code));
  return (
    <Shell user={user} active="estoque">
      <EstoqueView branches={branches} restricted={allowed !== null} canMatrix={allowed === null || allowed.includes(1)} />
    </Shell>
  );
}
