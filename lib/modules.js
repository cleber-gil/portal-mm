// Registro dos módulos do Portal MM.
// internal: rota dentro do portal (protegida por permissão).
// external: atalho para um app que ainda não foi migrado (a permissão só controla a exibição do atalho).
export const MODULES = [
  {
    id: "cadastro",
    name: "Cadastro de Produtos",
    description: "Referências por coleção, classificações e famílias, gravando no TOTVS.",
    href: "/cadastro",
    type: "internal",
  },
  {
    id: "vendas",
    name: "Painel de Vendas",
    description: "Vendas por filial, cliente, produto e família.",
    href: "https://totvs-sales-explorer-hde8.vercel.app",
    type: "external",
  },
  {
    id: "estoque",
    name: "Estoque",
    description: "Saldo por referência, cor, tamanho e loja.",
    href: "https://estoque-martha-medeiros.vercel.app",
    type: "external",
  },
];

export const LEVELS = [
  { id: "view", name: "Consulta" },
  { id: "edit", name: "Edição" },
];

export function moduleById(id) {
  return MODULES.find((m) => m.id === id) || null;
}
