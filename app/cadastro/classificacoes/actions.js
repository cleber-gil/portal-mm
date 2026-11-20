"use server";

import { revalidatePath } from "next/cache";
import { currentUser, canAccess } from "@/lib/auth";
import { audit } from "@/lib/db";
import { CLASSIFICATION_TYPES, listClassificationValues, upsertClassificationValue } from "@/lib/totvs";

// tira acento e padroniza em maiúsculas (padrão do cadastro: "PAETE SOLEIL")
function cleanName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export async function saveValueAction(_prev, formData) {
  const user = await currentUser();
  if (!user || !canAccess(user, "cadastro", "edit")) return { error: "Sem permissão de edição." };

  const typeCode = Number(formData.get("typeCode"));
  let code = String(formData.get("code") || "").trim().toUpperCase();
  const name = cleanName(formData.get("name"));
  if (!CLASSIFICATION_TYPES.some((t) => t.code === typeCode)) return { error: "Tipo inválido." };
  if (!name) return { error: "Informe o nome." };
  if (name.length > 40) return { error: "Nome com no máximo 40 caracteres." };

  const values = await listClassificationValues();
  const list = values[typeCode] || [];
  const isNew = !code;
  if (isNew) {
    if (list.some((v) => cleanName(v.name) === name)) return { error: `"${name}" já existe nesse tipo.` };
    // próximo código numérico, com a mesma largura dos existentes (ex.: "05")
    const width = list.reduce((m, v) => Math.max(m, v.code.length), 2);
    const next = list.reduce((m, v) => Math.max(m, parseInt(v.code, 10) || 0), 0) + 1;
    code = String(next).padStart(width, "0");
  }
  if (code.length > 10) return { error: "Código com no máximo 10 caracteres." };

  try {
    await upsertClassificationValue(typeCode, code, name);
  } catch (e) {
    return { error: e.message };
  }
  await audit(user.id, "cadastro", isNew ? "criar_classificacao" : "renomear_classificacao", { typeCode, code, name });
  revalidatePath("/cadastro/classificacoes");
  revalidatePath("/cadastro");
  return { ok: isNew ? `Criado ${code} · ${name}.` : `Atualizado ${code} · ${name}.` };
}
