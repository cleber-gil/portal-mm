import Link from "next/link";
import Shell from "./_components/Shell";
import { Icon } from "./_components/icons";
import { requireUser } from "@/lib/auth";
import { MODULES, LEVELS } from "@/lib/modules";

export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function Home({ searchParams }) {
  const user = await requireUser();
  const allowed = MODULES.filter((m) => user.modules[m.id]);
  const denied = searchParams?.negado;

  return (
    <Shell user={user}>
      <div className="home">
        <section className="home-intro reveal">
          <div className="eyebrow">Portal MM</div>
          <h1 style={{ marginTop: 10 }}>
            {greeting()}, {user.name.split(" ")[0]}.
          </h1>
          <p>
            {allowed.length
              ? `Você tem acesso a ${allowed.length} ${allowed.length === 1 ? "módulo" : "módulos"}.`
              : "Ainda não há módulos liberados para o seu usuário."}
          </p>
          {denied ? (
            <div className="alert error" style={{ marginTop: 16 }}>
              <Icon name="erro" size={16} />
              Você não tem acesso a esse módulo. Fale com o administrador.
            </div>
          ) : null}
        </section>

        <section className="module-list" aria-label="Módulos">
          {allowed.length === 0 ? (
            <div className="empty">
              <Icon name="vazio" size={28} />
              <b>Nenhum módulo por aqui.</b>
              <span>Peça ao administrador para liberar o acesso em Usuários.</span>
            </div>
          ) : (
            allowed.map((m, i) => {
              const level = LEVELS.find((l) => l.id === user.modules[m.id])?.name;
              const inner = (
                <>
                  <span className="icon">
                    <Icon name={m.id} size={20} />
                  </span>
                  <span>
                    <h3>{m.name}</h3>
                    <span className="text-2 small">{m.description}</span>
                  </span>
                  <span className="meta">
                    <span className="chip">{level}</span>
                    {m.type === "external" ? <Icon name="externo" size={16} /> : null}
                  </span>
                </>
              );
              const style = { "--i": i };
              return m.type === "internal" ? (
                <Link key={m.id} href={m.href} className="module reveal" style={style}>
                  {inner}
                </Link>
              ) : (
                <a key={m.id} href={m.href} target="_blank" rel="noreferrer" className="module reveal" style={style}>
                  {inner}
                </a>
              );
            })
          )}
        </section>
      </div>
    </Shell>
  );
}
