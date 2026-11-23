"use client";
import { useEffect, useRef, useState } from "react";

// número que conta do zero até o valor quando aparece (dinheiro em centavos ou inteiro)
export function Numero({ valor, dinheiro = false }: { valor: number; dinheiro?: boolean }) {
  const [v, setV] = useState(valor);
  const primeiro = useRef(true);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(valor); return; }
    const de = primeiro.current ? 0 : v;
    primeiro.current = false;
    const t0 = performance.now(), dur = 900;
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(de + (valor - de) * e));
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return <>{dinheiro ? (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : v.toLocaleString("pt-BR")}</>;
}
