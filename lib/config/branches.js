// Filiais da Martha Medeiros no TOTVS (código -> nome curto).
// Mesma numeração em vendas, estoque e notas fiscais.
export const BRANCHES = [
  { code: 1, name: "Matriz" },
  { code: 2, name: "Espírito Santo" },
  { code: 5, name: "Melo" },
  { code: 6, name: "Iguatemi" },
  { code: 7, name: "Tangará" },
  { code: 9, name: "Goiânia" },
  { code: 10, name: "Noiva" },
  { code: 11, name: "Curitiba" },
  { code: 12, name: "Flamboyant" },
];

// códigos usados nas consultas à TOTVS (mesma ordem da lista acima)
export const MATRIX_BRANCH = 1;
export const ALL_BRANCH_CODES = BRANCHES.map((b) => b.code);
export const STORE_BRANCH_CODES = ALL_BRANCH_CODES.filter((c) => c !== MATRIX_BRANCH);

export const ROLES = [
  { id: "admin", name: "Administrador", description: "Acesso total. Gerencia todos os usuários." },
  { id: "gestor", name: "Gestor", description: "Gerencia a própria equipe, concedendo só o que ele mesmo tem." },
  { id: "usuario", name: "Usuário", description: "Usa os módulos e filiais liberados." },
];

export function branchName(code) {
  return BRANCHES.find((b) => b.code === Number(code))?.name || String(code);
}
