// Regras de hierarquia (funções puras, sem banco — testáveis isoladamente)
import { MODULES } from "../config/modules";
import { BRANCHES } from "../config/branches";

const LEVEL_RANK = { view: 1, edit: 2 };

export function isAdmin(u) {
  return u?.role === "admin";
}
export function isGestor(u) {
  return u?.role === "gestor";
}
export function canManageUsers(u) {
  return isAdmin(u) || isGestor(u);
}

// o ator pode ver/editar o usuário alvo?
export function canManageTarget(actor, target) {
  if (!actor || !target) return false;
  if (isAdmin(actor)) return true;
  if (isGestor(actor)) return target.role === "usuario" && target.manager_id === actor.id;
  return false;
}

// filiais que o usuário enxerga: null = todas
export function visibleBranches(u) {
  if (!u) return [];
  if (isAdmin(u) || u.all_branches) return null;
  return u.branches || [];
}

// limita o que o ator pode conceder ao que ele mesmo tem
export function sanitizeGrant(actor, wanted) {
  const out = { role: "usuario", modules: {}, allBranches: false, branches: [], managerId: null };

  // perfil e gestor responsável
  if (isAdmin(actor)) {
    out.role = ["admin", "gestor", "usuario"].includes(wanted.role) ? wanted.role : "usuario";
    out.managerId = out.role === "usuario" && wanted.managerId ? Number(wanted.managerId) : null;
  } else {
    out.role = "usuario";
    out.managerId = actor.id;
  }

  // módulos: gestor só concede módulos que tem, no máximo no próprio nível
  for (const m of MODULES) {
    const level = wanted.modules?.[m.id];
    if (!LEVEL_RANK[level]) continue;
    if (isAdmin(actor)) {
      out.modules[m.id] = level;
      continue;
    }
    const own = actor.modules?.[m.id];
    if (!own) continue;
    out.modules[m.id] = LEVEL_RANK[level] <= LEVEL_RANK[own] ? level : own;
  }

  // filiais: gestor só concede filiais que ele vê
  const actorBranches = visibleBranches(actor); // null = todas
  const valid = new Set(BRANCHES.map((b) => b.code));
  if (wanted.allBranches && actorBranches === null) {
    out.allBranches = true;
  } else {
    const wantedList = (wanted.branches || []).map(Number).filter((c) => valid.has(c));
    out.branches = actorBranches === null ? wantedList : wantedList.filter((c) => actorBranches.includes(c));
  }

  if (out.role === "admin") {
    out.allBranches = true;
    out.branches = [];
    out.modules = Object.fromEntries(MODULES.map((m) => [m.id, "edit"]));
  }
  return out;
}
