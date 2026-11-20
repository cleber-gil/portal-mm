import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "./_components/icons";
import { HeroGauge, DayBars, HalfGauge, DotColumns, MonthDial, StoreCompass } from "./_components/dash";
import { logoutAction } from "./actions";
import { requireUser, canAccess } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import { MODULES, LEVELS } from "@/lib/config/modules";
import { getMonthSales, getStockSnapshot, monthInfo } from "@/lib/home/data";
import "./home.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROLE_NAME = { admin: "Administrador", gestor: "Gestor", usuario: "Usuário" };
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const BRL_C = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const INT = new Intl.NumberFormat("pt-BR");
const PCT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

function Card({ title, href, className = "", i = 0, children }) {
  return (
    <section className={`dcard ${className}`} style={{ "--i": i }}>
      <header>
        <h2>{title}</h2>
        {href ? (
          <Link href={href} className="dcard-go" aria-label={`Abrir ${title}`}>
            <Icon name="externo" size={15} />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="dstat">
      <span>{label}</span>
      <b>
        {value}
        {unit ? <small>{unit}</small> : null}
      </b>
    </div>
  );
}

const Fail = ({ title, className, i }) => (
  <Card title={title} className={className} i={i}>
    <p className="small muted">Não foi possível ler a TOTVS agora. Tente de novo em instantes.</p>
  </Card>
);

const Skel = ({ className, i, title }) => (
  <Card title={title} className={className} i={i}>
    <div className="skeleton" style={{ flex: 1, minHeight: 90, borderRadius: 14 }} />
  </Card>
);

// ---------- blocos com dados (carregam em paralelo, a página abre na hora) ----------
async function HeroData({ k }) {
  const m = await getMonthSales(k);
  if (m.error) return null;
  return (
    <div className="hero-figure">
      <HeroGauge value={m.elapsed} label={`${Math.round(m.elapsed * 100)}% do mês`} />
      <div className="hero-read">
        <span className="eyebrow">Vendido em {m.month.label}</span>
        <b className="mono">{BRL.format(m.net)}</b>
        <span className="text-2 small">
          Projeção do mês <b className="mono">{BRL_C.format(m.projection)}</b>
        </span>
      </div>
    </div>
  );
}

async function DaysCard({ k }) {
  const m = await getMonthSales(k);
  if (m.error) return <Fail title="Vendas por dia" className="c-days" i={1} />;
  const maxNet = Math.max(...m.days.map((d) => d.net), 0);
  const maxQty = Math.max(...m.days.map((d) => d.quantity), 0);
  return (
    <Card title="Vendas por dia" href="/vendas" className="c-days" i={1}>
      <div className="days-wrap">
        <span className="axis left mono">{INT.format(maxQty)}<br />pçs</span>
        <DayBars days={m.days} today={m.month.today} />
        <span className="axis right mono">{BRL_C.format(maxNet)}</span>
      </div>
      <div className="legend">
        <span><i className="lg q" /> Peças</span>
        <span><i className="lg n" /> Valor líquido</span>
      </div>
    </Card>
  );
}

async function TopBranchCard({ k }) {
  const m = await getMonthSales(k);
  if (m.error) return <Fail title="Loja destaque" className="c-top" i={2} />;
  const t = m.topBranch;
  return (
    <Card title="Loja destaque" className="c-top" i={2}>
      <b className="big mono">{t ? PCT.format(t.share) : "—"}</b>
      <HalfGauge value={t?.share || 0} center={t ? BRL_C.format(t.net) : "—"} sub={t ? t.name : "sem vendas"} />
    </Card>
  );
}

async function ReturnsCard({ k }) {
  const m = await getMonthSales(k);
  if (m.error) return <Fail title="Vendas sem devolução" className="c-ret" i={3} />;
  const last = m.days.slice(0, m.month.today).slice(-10).map((d) => d.count);
  return (
    <Card title="Vendas sem devolução" className="c-ret" i={3}>
      <b className="big mono">{PCT.format(1 - m.returnRate)}</b>
      <DotColumns values={last} />
      <span className="small muted">Vendas por dia · últimos {last.length} dias</span>
    </Card>
  );
}

async function OverviewCard({ k }) {
  const m = await getMonthSales(k);
  if (m.error) return <Fail title="Resumo do mês" className="c-over" i={4} />;
  return (
    <Card title={`Resumo de ${m.month.label}`} href="/vendas" className="c-over" i={4}>
      <div className="split">
        <div className="stats">
          <Stat label="Valor líquido" value={BRL_C.format(m.net)} />
          <Stat label="Peças vendidas" value={INT.format(m.quantity)} unit="pçs" />
          <Stat label="Vendas" value={INT.format(m.count)} unit="un." />
          <Stat label="Ticket médio" value={BRL.format(m.ticket)} />
        </div>
        <MonthDial today={m.month.today} days={m.month.daysInMonth} />
      </div>
    </Card>
  );
}

async function StockCard({ k }) {
  const s = await getStockSnapshot(k);
  if (s.error) return <Fail title="Estoque nas lojas" className="c-stock" i={5} />;
  return (
    <Card title="Estoque nas lojas" href="/estoque" className="c-stock" i={5}>
      <div className="split">
        <div className="stats">
          <Stat label="Peças em loja" value={INT.format(s.pieces)} unit="pçs" />
          <Stat label="Referências" value={INT.format(s.references)} unit="refs" />
          <Stat label="Em condicional" value={s.conditionalPieces == null ? "—" : INT.format(s.conditionalPieces)} unit="pçs" />
          <Stat label="Clientes c/ condicional" value={s.conditionalClients == null ? "—" : INT.format(s.conditionalClients)} />
        </div>
        <StoreCompass stores={s.branches} />
      </div>
    </Card>
  );
}

export default async function Home({ searchParams }) {
  const user = await requireUser();
  const allowed = MODULES.filter((m) => user.modules[m.id]);
  const denied = searchParams?.negado;
  const vis = visibleBranches(user);
  const k = vis ? vis.join(",") : "";
  const sales = canAccess(user, "vendas");
  const stock = canAccess(user, "estoque");
  const manager = user.role === "admin" || user.role === "gestor";
  const mi = monthInfo();
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

  return (
    <div className="dash-page">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <div className="dash-frame">
        <header className="dash-top">
          <Link href="/" className="dash-brand" aria-label="Início">
            <img src="/mm-emblema.webp" alt="" width="20" height="28" className="spark" />
            <span translate="no">MARTHA MEDEIROS</span>
          </Link>
          <nav className="dash-nav" aria-label="Módulos">
            <Link href="/" className="active" aria-current="page">
              <Icon name="inicio" size={15} /> Início
            </Link>
            {allowed.map((m) =>
              m.type === "internal" ? (
                <Link key={m.id} href={m.href}>
                  <Icon name={m.id} size={15} /> {m.name.replace(" de Produtos", "").replace("Painel de ", "")}
                </Link>
              ) : (
                <a key={m.id} href={m.href} target="_blank" rel="noreferrer">
                  <Icon name={m.id} size={15} /> {m.name.replace(" Vendas", "")}
                </a>
              )
            )}
            {manager ? (
              <Link href="/admin/usuarios">
                <Icon name="usuarios" size={15} /> {user.role === "admin" ? "Usuários" : "Equipe"}
              </Link>
            ) : null}
          </nav>
          <div className="dash-user">
            <form action={logoutAction}>
              <button type="submit" className="round" aria-label="Sair" title="Sair">
                <Icon name="sair" size={16} />
              </button>
            </form>
            <span className="avatar" title={`${user.name} · ${ROLE_NAME[user.role] || ""}`}>{initials(user.name)}</span>
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className={`dash-grid${sales ? "" : " no-sales"}`}>
          <section className="dash-hero">
            <div className="hero-copy">
              <span className="eyebrow">{today}</span>
              <h1>
                {greeting()}, <em>{user.name.split(" ")[0]}</em>.
              </h1>
              <p className="text-2">
                {sales ? `Dia ${mi.today} de ${mi.daysInMonth}. Vendas a clientes, sem as vendas entre empresas do grupo.` : "Escolha um módulo para começar."}
              </p>
              {denied ? (
                <div className="alert error" style={{ marginTop: 12 }}>
                  <Icon name="erro" size={16} /> Você não tem acesso a esse módulo.
                </div>
              ) : null}
            </div>
            {sales ? (
              <Suspense fallback={<div className="hero-figure"><div className="skeleton" style={{ width: "62%", aspectRatio: "1", borderRadius: "50%" }} /></div>}>
                <HeroData k={k} />
              </Suspense>
            ) : null}
          </section>

          {sales ? (
            <>
              <Suspense fallback={<Skel title="Vendas por dia" className="c-days" i={1} />}>
                <DaysCard k={k} />
              </Suspense>
              <Suspense fallback={<Skel title="Loja destaque" className="c-top" i={2} />}>
                <TopBranchCard k={k} />
              </Suspense>
              <Suspense fallback={<Skel title="Vendas sem devolução" className="c-ret" i={3} />}>
                <ReturnsCard k={k} />
              </Suspense>
              <Suspense fallback={<Skel title="Resumo do mês" className="c-over" i={4} />}>
                <OverviewCard k={k} />
              </Suspense>
            </>
          ) : (
            <section className="dcard c-mods" style={{ "--i": 1 }}>
              <header><h2>Seus módulos</h2></header>
              <div className="mods">
                {allowed.length === 0 ? (
                  <span className="text-2">Nenhum módulo liberado. Fale com o administrador.</span>
                ) : (
                  allowed.map((m) => (
                    <a key={m.id} href={m.href} {...(m.type === "external" ? { target: "_blank", rel: "noreferrer" } : {})} className="mod">
                      <span className="icon"><Icon name={m.id} size={18} /></span>
                      <span><b>{m.name}</b><br /><span className="small muted">{LEVELS.find((l) => l.id === user.modules[m.id])?.name}</span></span>
                    </a>
                  ))
                )}
              </div>
            </section>
          )}

          {stock ? (
            <Suspense fallback={<Skel title="Estoque nas lojas" className="c-stock" i={5} />}>
              <StockCard k={k} />
            </Suspense>
          ) : null}
        </main>
      </div>
    </div>
  );
}
