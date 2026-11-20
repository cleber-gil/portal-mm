# Portal MM

Portal interno Martha Medeiros: login único, permissões por módulo e módulos integrados ao TOTVS Moda.

## Módulos
- **Cadastro de Produtos** (`/cadastro`): referências por coleção, classificações 100–104 (linha, grupo, tipo, coleção, família), edição individual/em massa e cadastro de valores, gravando no TOTVS.
- Atalhos (ainda não migrados): Painel de Vendas, Estoque.

## Variáveis de ambiente
- `DATABASE_URL` — Postgres (Neon)
- `SESSION_SECRET` — 32+ caracteres
- `TOTVS_BASE_URL`, `TOTVS_CLIENT_ID`, `TOTVS_CLIENT_SECRET`, `TOTVS_USERNAME`, `TOTVS_PASSWORD`

## Primeiro acesso
Com o banco vazio, `/login` redireciona para `/setup`, que cria o administrador. Depois, usuários e módulos em **Usuários**.
