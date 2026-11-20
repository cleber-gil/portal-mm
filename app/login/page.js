import { redirect } from "next/navigation";
import AuthForm from "../_components/AuthForm";
import { loginAction } from "../actions";
import { currentUser, userCount } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    <div className="center-box">
      <div className="card auth-card stack">
        <div>
          <h1>Portal MM</h1>
          <p className="muted" style={{ margin: 0 }}>Martha Medeiros · acesso interno</p>
        </div>
        {dbError ? <div className="alert error">{dbError}</div> : null}
        <AuthForm
          action={loginAction}
          submitLabel="Entrar"
          fields={[
            { name: "email", label: "E-mail", type: "email", autoComplete: "username" },
            { name: "password", label: "Senha", type: "password", autoComplete: "current-password" },
          ]}
        />
      </div>
    </div>
  );
}
