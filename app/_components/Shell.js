import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { logoutAction } from "@/app/actions";

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
      <header className="topbar">
        <Link href="/" className="brand">
          <b>MM</b> PORTAL
        </Link>
        <nav className="nav">
          {allowed.map((m) =>
            m.type === "internal" ? (
              <Link key={m.id} href={m.href} className={active === m.id ? "active" : ""}>
                {m.name}
              </Link>
            ) : (
              <a key={m.id} href={m.href} target="_blank" rel="noreferrer">
                {m.name} ↗
              </a>
            )
          )}
          {user.is_admin ? (
            <Link href="/admin/usuarios" className={active === "admin" ? "active" : ""}>
              Usuários
            </Link>
          ) : null}
        </nav>
        <div className="spacer" />
        <div className="userbox" title={user.email}>
          <span className="avatar">{initials(user.name)}</span>
          <span>
            {user.name}
            <br />
            <span className="muted small">{user.is_admin ? "Administrador" : user.email}</span>
          </span>
          <form action={logoutAction}>
            <button className="btn secondary" type="submit">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
