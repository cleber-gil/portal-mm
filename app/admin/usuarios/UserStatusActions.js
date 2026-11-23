"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setActiveAction, deleteUserAction } from "./actions";

function Btn({ children, className, pendingLabel }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

// inativar/reativar e excluir (com confirmação em dois passos, sem diálogo do navegador)
export default function UserStatusActions({ user }) {
  const [activeState, activeAction] = useFormState(setActiveAction, null);
  const [deleteState, deleteAction] = useFormState(deleteUserAction, null);
  const [confirming, setConfirming] = useState(false);
  const msg = deleteState?.error || activeState?.error;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 15 }}>Situação do usuário</h2>
      {msg ? <div className="alert error" role="alert">{msg}</div> : null}
      {activeState?.ok ? <div className="alert success" role="status">{activeState.ok}</div> : null}

      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <form action={activeAction}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="active" value={user.active ? "0" : "1"} />
          <Btn className="btn secondary" pendingLabel="Salvando…">
            {user.active ? "Inativar usuário" : "Reativar usuário"}
          </Btn>
        </form>

        {!confirming ? (
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
            Excluir usuário
          </button>
        ) : (
          <form action={deleteAction} className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={user.id} />
            <span className="small" style={{ color: "var(--danger)" }}>
              Excluir {user.name} de vez? Não dá para desfazer.
            </span>
            <Btn className="btn danger" pendingLabel="Excluindo…">Confirmar exclusão</Btn>
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </form>
        )}
      </div>
      <p className="small text-2" style={{ margin: 0 }}>
        Inativar bloqueia o acesso na hora e mantém o cadastro. Excluir apaga o usuário; o histórico de auditoria é mantido.
      </p>
    </div>
  );
}
