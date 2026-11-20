"use client";

// ícones Phosphor com peso único em todo o portal
import {
  Package,
  ChartLineUp,
  Warehouse,
  UsersThree,
  SignOut,
  ArrowUpRight,
  ArrowLeft,
  Tag,
  MagnifyingGlass,
  WarningCircle,
  CheckCircle,
  Tray,
  X,
} from "@phosphor-icons/react";

const WEIGHT = "regular";

export function Icon({ name, size = 18, ...rest }) {
  const map = {
    cadastro: Package,
    vendas: ChartLineUp,
    estoque: Warehouse,
    usuarios: UsersThree,
    sair: SignOut,
    externo: ArrowUpRight,
    voltar: ArrowLeft,
    tag: Tag,
    busca: MagnifyingGlass,
    erro: WarningCircle,
    ok: CheckCircle,
    vazio: Tray,
    fechar: X,
  };
  const C = map[name];
  return C ? <C size={size} weight={WEIGHT} aria-hidden="true" {...rest} /> : null;
}
