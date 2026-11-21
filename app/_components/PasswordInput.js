"use client";

import { useState } from "react";
import { Icon } from "./icons";

// campo de senha com o "olhinho" para mostrar/ocultar
export default function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw">
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="pw-eye"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
        title={show ? "Ocultar senha" : "Mostrar senha"}
      >
        <Icon name={show ? "ocultar" : "ver"} size={18} />
      </button>
    </span>
  );
}
