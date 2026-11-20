import Link from "next/link";
import { MODULES } from "@/lib/config/modules";
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

function RailItem({ href, label, icon, active, external }) {
  const content = (
    <>
      <Icon name={icon} size={20} />
      {external ? <Icon name="externo" size={10} className="ext" /> : null}
      <span className="tip">{label}</span>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className="rail-item" aria-label={`${label} (abre em nova aba)`}>
      {content}
    </a>
  ) : (
    <Link href={href} className={`rail-item${active ? " active" : ""}`} aria-label={label} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}

// casca das páginas logadas: trilho lateral flutuante (barra inferior no celular) + área principal
export default function Shell({ user, active, children }) {
  const allowed = MODULES.filter((m) => user.modules[m.id]);
  const current = MODULES.find((m) => m.id === active);
  const manager = user.role === "admin" || user.role === "gestor";
  const teamLabel = user.role === "admin" ? "Usuários" : "Minha equipe";
  return (
    <div className="app">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="rail" aria-label="Navegação">
        <Link href="/" className="brand" aria-label="Início" translate="no">
          MM
        </Link>
        <nav aria-label="Módulos">
          <RailItem href="/" label="Início" icon="inicio" active={!active} />
          {allowed.map((m) => (
            <RailItem key={m.id} href={m.href} label={m.name} icon={m.id} active={active === m.id} external={m.type === "external"} />
          ))}
          {manager ? <RailItem href="/admin/usuarios" label={teamLabel} icon="usuarios" active={active === "admin"} /> : null}
        </nav>
        <span className="spacer" />
        <form action={logoutAction}>
          <button className="rail-item" type="submit" aria-label="Sair">
            <Icon name="sair" size={20} />
            <span className="tip">Sair</span>
          </button>
        </form>
      </aside>
      <div className="main">
        <header className="appbar">
          <div className="crumb">
            <span>Portal MM</span>
            {current || active === "admin" ? (
              <>
                <span aria-hidden="true">/</span>
                <b>{current ? current.name : teamLabel}</b>
              </>
            ) : null}
          </div>
          <div className="userbox" title={user.email}>
            <span className="who">
              <b style={{ fontWeight: 600 }}>{user.name}</b>
              <br />
              <span className="muted small">{ROLE_NAME[user.role] || user.email}</span>
            </span>
            <span className="avatar">{initials(user.name)}</span>
          </div>
        </header>
        <main className="page" id="conteudo" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
