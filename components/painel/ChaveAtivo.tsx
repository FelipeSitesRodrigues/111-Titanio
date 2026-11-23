"use client";
import { useState, useTransition } from "react";
import { useAviso } from "./Avisos";
import { alternarAtivo } from "@/app/painel/acoes/produtos";

// liga/desliga o produto na loja direto do cartão
export function ChaveAtivo({ id, ativo, nome }: { id: string; ativo: boolean; nome: string }) {
  const [on, setOn] = useState(ativo);
  const [, comecar] = useTransition();
  const avisar = useAviso();
  return (
    <label className="p-chave" title={on ? "Aparece na loja" : "Escondido da loja"}>
      <input type="checkbox" checked={on} aria-label={`${nome}: ${on ? "na loja" : "fora da loja"}`}
        onChange={(e) => {
          const novo = e.target.checked;
          setOn(novo);
          comecar(async () => {
            const r = await alternarAtivo(id, novo);
            if (!r.ok) { setOn(!novo); avisar(r.erro, true); } else avisar(novo ? "Produto na loja" : "Produto escondido da loja");
          });
        }} />
      <i />
    </label>
  );
}
