import { redirect } from "next/navigation";
import AuthForm from "../_components/AuthForm";
import AuthLayout from "../_components/AuthLayout";
import { loginAction } from "../actions";
import { currentUser, userCount } from "@/lib/core/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  let setupNeeded = false;
  let dbError = "";
  try {
    if (await currentUser()) redirect("/");
    setupNeeded = (await userCount()) === 0;
  } catch (e) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    dbError = e.message || String(e);
  }
  if (setupNeeded) redirect("/setup");

  return (
    <AuthLayout title="Entrar" subtitle="Use o e-mail e a senha cadastrados pelo administrador.">
      {dbError ? <div className="alert error">{dbError}</div> : null}
      <AuthForm
        action={loginAction}
        submitLabel="Entrar"
        fields={[
          { name: "email", label: "E-mail", type: "email", autoComplete: "username" },
          { name: "password", label: "Senha", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthLayout>
  );
}
