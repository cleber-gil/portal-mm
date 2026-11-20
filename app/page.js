import Link from "next/link";
import Shell from "./_components/Shell";
import { Icon } from "./_components/icons";
import { requireUser } from "@/lib/core/auth";
import { MODULES, LEVELS } from "@/lib/config/modules";

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

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

  return (
    <Shell user={user}>
      <section className="hero reveal">
        <div>
          <div className="eyebrow" style={{ color: "#a9bac6" }}>{today}</div>
          <h1 style={{ marginTop: 8 }}>
            {greeting()}, <em>{user.name.split(" ")[0]}</em>.
          </h1>
          <p>
            {allowed.length
              ? `Você tem acesso a ${allowed.length} ${allowed.length === 1 ? "módulo" : "módulos"}. Produto, vendas, estoque e clientes conectados ao TOTVS.`
              : "Ainda não há módulos liberados para o seu usuário."}
          </p>
        </div>
        <div className="hero-side">
          <span className="pill">
            <span className="live-dot" aria-hidden="true" /> TOTVS conectado
          </span>
          {allowed[0] ? (
            allowed[0].type === "internal" ? (
              <Link href={allowed[0].href} className="pill accent" style={{ textDecoration: "none" }}>
                Abrir {allowed[0].name}
              </Link>
            ) : null
          ) : null}
        </div>
      </section>

      {denied ? (
        <div className="alert error reveal" style={{ marginBottom: 18 }}>
          <Icon name="erro" size={16} />
          Você não tem acesso a esse módulo. Fale com o administrador.
        </div>
      ) : null}

      <section className="module-list" aria-label="Módulos">
        {allowed.length === 0 ? (
          <div className="empty panel">
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
                  <Icon name={m.id} size={22} />
                </span>
                <span>
                  <h3>{m.name}</h3>
                  <span className="text-2 small" style={{ display: "block", marginTop: 6 }}>
                    {m.description}
                  </span>
                </span>
                <span className="meta">
                  <span className="chip">{m.type === "external" ? `${level} · nova aba` : level}</span>
                  <span className="go">
                    <Icon name="externo" size={14} />
                  </span>
                </span>
              </>
            );
            const style = { "--i": i + 1 };
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
    </Shell>
  );
}
