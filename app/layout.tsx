import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--fonte-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "Titânio Importes",
  description: "Tecnologia, casa, ferramenta e muito mais, importado direto da fonte.",
};

// tema salvo antes da 1ª pintura (mesma chave do protótipo)
const TEMA = `try{var t=localStorage.getItem('tema');if(t)document.documentElement.dataset.theme=t;else if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark'}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="light" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
