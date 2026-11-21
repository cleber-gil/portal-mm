import MobileCollapse from "../_components/MobileCollapse";
import Shell from "../_components/Shell";
import { Icon } from "../_components/icons";
import { getReport, defaultDates, SCOPES } from "@/lib/sales/report";
import { requireModule } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import "./vendas.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Painel de Vendas" };

// ---------- formatação (Intl) ----------
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const INT = new Intl.NumberFormat("pt-BR");
const DEC1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

const money = (v) => BRL.format(Number(v) || 0);
const moneyCompact = (v) => BRL_COMPACT.format(Number(v) || 0);
const num = (v) => INT.format(Number(v) || 0);
const day = (iso) => DATE.format(new Date(`${iso}T00:00:00Z`));

function turnoverLabel(p) {
  if (p.zeroStockButSelling) return <span className="chip warn">sem estoque</span>;
  if (p.turnoverRatio == null) return "—";
  return `${DEC1.format(p.turnoverRatio)}×`;
}

function coverageLabel(p) {
  if (p.zeroStockButSelling) return <span className="chip warn">sem estoque</span>;
  if (p.daysOfCoverage == null) return "—";
  if (p.daysOfCoverage === Infinity) return <span className="chip">parado</span>;
  return `${num(Math.round(p.daysOfCoverage))} d`;
}

// "MEDEIROS VESTUARIO E CONFECCOES LTDA - IGUATEMI" -> "IGUATEMI"; sem sufixo = matriz/indústria
function shortBranch(name) {
  const n = String(name || "");
  const i = n.lastIndexOf(" - ");
  if (i >= 0) return n.slice(i + 3).trim();
  return /INDUSTRIA/i.test(n) ? "MATRIZ (INDÚSTRIA)" : n;
}

// ---------- componentes ----------
function Bars({ id, title, rows, emptyText, labelFn = (s) => s }) {
  const sorted = [...rows].sort((a, b) => b.net - a.net);
  const max = sorted.reduce((m, r) => Math.max(m, r.net), 0);
  const total = sorted.reduce((s, r) => s + Math.max(0, r.net), 0);
  return (
    <section aria-labelledby={id}>
      <div className="section-title">
        <h2 id={id}>{title}</h2>
        <span className="small muted mono">{moneyCompact(total)}</span>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">
          <Icon name="vazio" size={24} />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className="bars">
          {sorted.map((r, i) => {
            const full = r.name || r.key;
            const label = labelFn(full);
            const w = max > 0 ? Math.max(r.net / max, r.net > 0 ? 0.015 : 0) : 0;
            return (
              <div
                key={r.key}
                className={`bar${label === "Sem família" ? " muted-row" : ""}`}
                title={`${full}: ${money(r.net)} · ${num(r.quantity)} peças`}
              >
                <span className="name">{label}</span>
                <span className="track" aria-hidden="true">
                  <span className="fill" style={{ "--w": w, "--i": i, display: "block" }} />
                </span>
                <span className="val">{moneyCompact(r.net)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Select({ id, label, value, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={id} defaultValue={value}>
        {children}
      </select>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="empty">
      <Icon name="vazio" size={24} />
      <span>{text}</span>
    </div>
  );
}

// ---------- página ----------
export default async function VendasPage({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  const user = await requireModule("vendas", "view");
  const allowedBranches = visibleBranches(user); // null = todas
  const defaults = defaultDates();
  const start = searchParams?.start || defaults.start;
  const end = searchParams?.end || defaults.end;
  const branch = searchParams?.branch || "";
  const collection = searchParams?.collection || "";
  const client = searchParams?.client || "";
  const family = searchParams?.family || "";
  const scope = searchParams?.scope || "clientes";

  let report = null;
  let errorMsg = "";
  try {
    report = await getReport({ start, end, branch, collection, client, family, scope, allowedBranches });
  } catch (e) {
    errorMsg = e.message || String(e);
  }

  const opts = report?.branchOptions || [];
  const branchLabel =
    (branch && opts.find((b) => b.code === branch)?.name) ||
    (allowedBranches !== null ? (opts.length === 1 ? opts[0].name : "Suas filiais") : "Todas as filiais");

  const exportQuery = new URLSearchParams({
    start,
    end,
    ...(branch ? { branch } : {}),
    ...(collection ? { collection } : {}),
    ...(client ? { client } : {}),
    ...(family ? { family } : {}),
    ...(scope !== "clientes" ? { scope } : {}),
  }).toString();

  // link para a mesma tela trocando só o escopo
  const scopeHref = (id) => {
    const q = new URLSearchParams({ start, end, ...(branch ? { branch } : {}), ...(collection ? { collection } : {}), ...(client ? { client } : {}), ...(family ? { family } : {}) });
    if (id !== "clientes") q.set("scope", id);
    return `/vendas?${q.toString()}`;
  };
  const scopeName = SCOPES.find((x) => x.id === (report?.scope || scope))?.name;

  const topClients = report ? [...report.byClient].sort((a, b) => b.net - a.net).slice(0, 25) : [];
  const topProducts = report ? [...report.byProduct].sort((a, b) => b.quantity - a.quantity).slice(0, 40) : [];
  const ticket = report && report.totals.count ? report.totals.net / report.totals.count : 0;

  const branchesNote = allowedBranches === null ? null : `Você vê só as filiais liberadas para o seu usuário.`;

  return (
    <Shell user={user} active="vendas">
      <div className="vendas">
        <header className="head">
          <div>
            <div className="eyebrow">
              <span translate="no">Martha Medeiros</span> · TOTVS Moda
            </div>
            <h1>Painel de Vendas</h1>
            <p>
              {branchLabel} · {day(start)} a {day(end)}
              {report?.period?.days ? ` (${num(report.period.days)} dias)` : ""}
            </p>
          </div>
          <nav className="exports" aria-label="Exportar">
            <a className="btn secondary" href={`/api/vendas/export/excel?${exportQuery}`}>
              <Icon name="excel" /> Excel
            </a>
            <a className="btn secondary" href={`/api/vendas/export/pdf?${exportQuery}`}>
              <Icon name="pdf" /> PDF
            </a>
            <a className="btn secondary" href={`/api/vendas/export/docx?${exportQuery}`}>
              <Icon name="word" /> Word
            </a>
          </nav>
        </header>

        <MobileCollapse summary={`${branchLabel} · ${day(start)} a ${day(end)}`}>
        <form className="filters" method="get" aria-label="Filtros">
          <div className="field">
            <label htmlFor="start">Data inicial</label>
            <input type="date" id="start" name="start" defaultValue={start} />
          </div>
          <div className="field">
            <label htmlFor="end">Data final</label>
            <input type="date" id="end" name="end" defaultValue={end} />
          </div>
          <Select id="branch" label="Filial" value={branch}>
            <option value="">{allowedBranches === null ? "Todas as filiais" : "Todas as minhas filiais"}</option>
            {(report?.branchOptions || []).map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select id="collection" label="Coleção" value={collection}>
            <option value="">Todas as coleções</option>
            {(report?.collectionOptions || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select id="family" label="Família" value={family}>
            <option value="">Todas as famílias</option>
            {(report?.familyOptions || []).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          <Select id="scope" label="Tipo de venda" value={scope}>
            {SCOPES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <Select id="client" label="Cliente" value={client}>
            <option value="">Todos os clientes</option>
            {(report?.clientOptions || []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
          <button className="btn" type="submit">
            <Icon name="filtro" /> Aplicar filtros
          </button>
        </form>
        </MobileCollapse>

        {branchesNote ? <p className="small text-2" style={{ marginTop: -12, marginBottom: 20 }}>{branchesNote}</p> : null}
        <section aria-label="Resultados">
          {errorMsg ? (
            <div className="alert error" role="alert">
              <Icon name="erro" />
              <span>
                Não foi possível buscar as vendas no TOTVS: {errorMsg}. Tente de novo em alguns minutos ou reduza o
                período.
              </span>
            </div>
          ) : (
            <>
              {report.intercompany.count > 0 || report.scope !== "clientes" ? (
                <div className={`alert ${report.scope === "clientes" ? "warn" : "info"}`} role="status" style={{ marginBottom: 24 }}>
                  <Icon name="grupo" />
                  <span>
                    {report.scope === "clientes" ? (
                      <>
                        <b>{money(report.intercompany.net)}</b> em {num(report.intercompany.count)} vendas entre empresas do grupo
                        ({report.intercompany.clients.slice(0, 2).join(", ")}
                        {report.intercompany.clients.length > 2 ? "…" : ""}) estão <b>fora</b> destes números.{" "}
                        <a href={scopeHref("grupo")}>Ver só essas</a> · <a href={scopeHref("todos")}>Ver tudo junto</a>
                      </>
                    ) : (
                      <>
                        Mostrando: <b>{scopeName}</b>. <a href={scopeHref("clientes")}>Voltar para vendas a clientes</a>
                      </>
                    )}
                  </span>
                </div>
              ) : null}
              <section className="metrics" aria-label="Resumo do período">
                <div className="metric primary reveal" style={{ "--i": 0 }}>
                  <div className="value">{money(report.totals.net)}</div>
                  <div className="label">Valor líquido · bruto {moneyCompact(report.totals.gross)}</div>
                </div>
                <div className="metric reveal" style={{ "--i": 1 }}>
                  <div className="value">{num(report.totals.quantity)}</div>
                  <div className="label">Peças vendidas</div>
                </div>
                <div className="metric reveal" style={{ "--i": 2 }}>
                  <div className="value">{num(report.totals.count)}</div>
                  <div className="label">Vendas</div>
                </div>
                <div className="metric reveal" style={{ "--i": 3 }}>
                  <div className="value">{moneyCompact(ticket)}</div>
                  <div className="label">Ticket médio</div>
                </div>
              </section>

              <div className="charts">
                <Bars
                  id="t-filial"
                  title="Vendas líquidas por filial"
                  rows={report.byBranch}
                  labelFn={shortBranch}
                  emptyText="Nenhuma venda no período."
                />
                <div>
                  {report.familyError ? (
                    <div className="alert warn" role="status" style={{ marginBottom: 12 }}>
                      <Icon name="erro" />
                      <span>Família indisponível agora ({report.familyError}). As vendas aparecem normalmente.</span>
                    </div>
                  ) : null}
                  <Bars
                    id="t-familia"
                    title="Vendas líquidas por família"
                    rows={report.byFamily || []}
                    emptyText="Sem vendas com família no período."
                  />
                </div>
              </div>

              <div className="tables">
                <section aria-labelledby="t-clientes">
                  <div className="section-title">
                    <h2 id="t-clientes">Top clientes</h2>
                    <span className="small muted">
                      por valor líquido · {num(topClients.length)} de {num(report.byClient.length)}
                    </span>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: 520 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th className="num">Peças</th>
                          <th className="num">Bruto</th>
                          <th className="num">Líquido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topClients.map((c) => (
                          <tr key={c.key}>
                            <td>
                              <span className="truncate" title={c.name}>
                                {c.name}
                              </span>
                              {c.intercompany ? (
                                <span className="chip warn" style={{ marginLeft: 8 }}>
                                  grupo
                                </span>
                              ) : null}
                            </td>
                            <td className="num">{num(c.quantity)}</td>
                            <td className="num">{money(c.gross)}</td>
                            <td className="num">{money(c.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {topClients.length === 0 ? <Empty text="Nenhum cliente com vendas nesses filtros." /> : null}
                  </div>
                </section>

                <section aria-labelledby="t-produtos">
                  <div className="section-title">
                    <h2 id="t-produtos">Top produtos</h2>
                    <span className="small muted">por quantidade · referência, cor e tamanho</span>
                  </div>
                  {report.stockError ? (
                    <div className="alert warn" role="status" style={{ marginBottom: 12 }}>
                      <Icon name="erro" />
                      <span>Giro de estoque indisponível agora ({report.stockError}).</span>
                    </div>
                  ) : null}
                  <div className="table-wrap" style={{ maxHeight: 620 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Referência</th>
                          <th>Coleção</th>
                          <th>Família</th>
                          <th>Descrição</th>
                          <th>Cor</th>
                          <th>Tam.</th>
                          <th className="num">Qtde</th>
                          <th className="num">Líquido</th>
                          <th className="num">Estoque</th>
                          <th className="num">Giro</th>
                          <th className="num">Cobertura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p, i) => (
                          <tr key={`${p.reference}-${p.color}-${p.size}-${i}`}>
                            <td className="mono" translate="no">
                              {p.reference}
                            </td>
                            <td className="mono">{p.collection}</td>
                            <td>
                              <span className={`chip${p.family && p.family !== "Sem família" ? " accent" : ""}`}>
                                {p.family || "Sem família"}
                              </span>
                            </td>
                            <td>
                              <span className="truncate" title={p.name}>
                                {p.name}
                              </span>
                            </td>
                            <td className="text-2">{p.color}</td>
                            <td className="mono">{p.size}</td>
                            <td className="num">{num(p.quantity)}</td>
                            <td className="num">{money(p.net)}</td>
                            <td className="num">{p.currentStock != null ? num(p.currentStock) : "—"}</td>
                            <td className="num">{turnoverLabel(p)}</td>
                            <td className="num">{coverageLabel(p)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {topProducts.length === 0 ? <Empty text="Nenhum produto vendido nesses filtros." /> : null}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}
