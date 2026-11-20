import { redirect } from "next/navigation";
import AuthForm from "../_components/AuthForm";
import { setupAction } from "../actions";
import { userCount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// primeiro acesso: cria o administrador. Some assim que existir 1 usuário.
export default async function SetupPage() {
  if ((await userCount()) > 0) redirect("/login");
  return (
    <div className="center-box">
      <div className="card auth-card stack">
        <div>
          <h1>Primeiro acesso</h1>
          <p className="muted" style={{ margin: 0 }}>
            Crie o usuário administrador do Portal MM. Depois disso esta tela deixa de existir.
          </p>
        </div>
        <AuthForm
          action={setupAction}
          submitLabel="Criar administrador"
          fields={[
            { name: "name", label: "Nome" },
            { name: "email", label: "E-mail", type: "email", autoComplete: "username" },
            { name: "password", label: "Senha (mín. 8 caracteres)", type: "password", autoComplete: "new-password" },
          ]}
        />
      </div>
    </div>
  );
}
