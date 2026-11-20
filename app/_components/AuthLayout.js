// tela dividida para login/primeiro acesso
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="mark">MM · Portal</div>
        <div className="statement">
          <h1>Produto, estoque e vendas no mesmo lugar.</h1>
          <p>Ferramentas internas da Martha Medeiros, conectadas ao TOTVS.</p>
        </div>
        <div className="foot">Acesso restrito à equipe · suporte@risolve.com.br</div>
      </aside>
      <main className="auth-main">
        <div className="auth-form stack">
          <div>
            <h2 style={{ fontSize: 22 }}>{title}</h2>
            {subtitle ? <p className="text-2" style={{ marginTop: 6 }}>{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
