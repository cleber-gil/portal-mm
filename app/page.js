import Link from "next/link";
import Shell from "./_components/Shell";
import { requireUser } from "@/lib/auth";
import { MODULES, LEVELS } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const user = await requireUser();
  const allowed = MODULES.filter((m) => user.modules[m.id]);
  const denied = searchParams?.negado;

  return (
    <Shell user={user}>
      <div className="stack">
        <div>
          <h1>Olá, {user.name.split(" ")[0]}</h1>
          <p className="muted" style={{ margin: 0 }}>Escolha um módulo.</p>
        </div>
        {denied ? (
          <div className="alert error">Você não tem acesso a esse módulo. Fale com o administrador.</div>
        ) : null}
        {allowed.length === 0 ? (
          <div className="card">Nenhum módulo liberado para o seu usuário ainda.</div>
        ) : (
          <div className="grid-tiles">
            {allowed.map((m) => {
              const level = LEVELS.find((l) => l.id === user.modules[m.id])?.name;
              const inner = (
                <>
                  <h3>
                    {m.name}
                    {m.type === "external" ? " ↗" : ""}
                  </h3>
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    {m.description}
                  </p>
                  <span className="chip">{level}</span>
                </>
              );
              return m.type === "internal" ? (
                <Link key={m.id} href={m.href} className="card tile">
                  {inner}
                </Link>
              ) : (
                <a key={m.id} href={m.href} target="_blank" rel="noreferrer" className="card tile">
                  {inner}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
