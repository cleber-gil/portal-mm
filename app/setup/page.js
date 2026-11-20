import { redirect } from "next/navigation";
import AuthForm from "../_components/AuthForm";
import AuthLayout from "../_components/AuthLayout";
import { setupAction } from "../actions";
import { userCount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// primeiro acesso: cria o administrador. Some assim que existir 1 usuário.
export default async function SetupPage() {
  if ((await userCount()) > 0) redirect("/login");
  return (
    <AuthLayout
      title="Primeiro acesso"
      subtitle="Crie o administrador do portal. Depois disso esta tela deixa de existir."
    >
      <AuthForm
        action={setupAction}
        submitLabel="Criar administrador"
        fields={[
          { name: "name", label: "Nome" },
          { name: "email", label: "E-mail", type: "email", autoComplete: "username" },
          { name: "password", label: "Senha", type: "password", autoComplete: "new-password", help: "Mínimo de 8 caracteres." },
        ]}
      />
    </AuthLayout>
  );
}
