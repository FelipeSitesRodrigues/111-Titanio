"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { Icone } from "./Icone";

type Aviso = { id: number; texto: string; erro?: boolean; saindo?: boolean };
const Ctx = createContext<(texto: string, erro?: boolean) => void>(() => {});
export const useAviso = () => useContext(Ctx);

export function Avisos({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, erro = false) => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l.slice(-2), { id, texto, erro }]);
    setTimeout(() => setLista((l) => l.map((a) => (a.id === id ? { ...a, saindo: true } : a))), 2800);
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), 3150);
  }, []);
  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className="p-avisos" role="status" aria-live="polite">
        {lista.map((a) => (
          <div key={a.id} className={`p-aviso${a.erro ? " p-aviso--erro" : ""}${a.saindo ? " sai" : ""}`}>
            <Icone n={a.erro ? "alerta" : "check"} />
            {a.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
