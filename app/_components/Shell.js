import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { logoutAction } from "@/app/actions";
import { Icon } from "./icons";

const ROLE_NAME = { admin: "Administrador", gestor: "Gestor", usuario: "Usuário" };

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

// casca das páginas logadas: topo com módulos permitidos e quem está logado
export default function Shell({ user, active, children }) {
  const allowed = MODULES.filter((m) => user.modules[m.id]);
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Início">
          <span className="brand-mark" translate="no">MM</span>
          <span className="brand-name">Portal</span>
        </Link>
        <nav className="nav" aria-label="Módulos">
          {allowed.map((m) =>
            m.type === "internal" ? (
              <Link key={m.id} href={m.href} className={active === m.id ? "active" : ""}>
                <Icon name={m.id} size={16} />
                {m.name}
              </Link>
            ) : (
              <a key={m.id} href={m.href} target="_blank" rel="noreferrer">
                <Icon name={m.id} size={16} />
                {m.name}
                <Icon name="externo" size={12} />
              </a>
            )
          )}
          {user.role === "admin" || user.role === "gestor" ? (
            <Link href="/admin/usuarios" className={active === "admin" ? "active" : ""}>
              <Icon name="usuarios" size={16} />
              {user.role === "admin" ? "Usuários" : "Minha equipe"}
            </Link>
          ) : null}
        </nav>
        <div className="userbox" title={user.email}>
          <span className="who">
            <b style={{ fontWeight: 600 }}>{user.name}</b>
            <br />
            <span className="muted small">{ROLE_NAME[user.role] || user.email}</span>
          </span>
          <span className="avatar">{initials(user.name)}</span>
          <form action={logoutAction}>
            <button className="btn ghost" type="submit" title="Sair" aria-label="Sair">
              <Icon name="sair" size={18} />
            </button>
          </form>
        </div>
      </header>
      <main className="page" id="conteudo" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
