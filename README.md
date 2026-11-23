# Titânio Importes: loja e painel

Loja online da Titânio Importes (Titânio Intermediações Internacional LTDA) com o painel da loja em `/painel`.
Next 16 (App Router, TypeScript), Supabase (banco, fotos e login) e Stripe (fase 2).

## Rodar no PC

```bash
npm install
npm run dev          # http://localhost:3111/painel
```

Precisa de `.env.local` (URL e chaves do Supabase, Stripe) e `.env.supabase.local`
(`SUPABASE_ACCESS_TOKEN`, só pros scripts). Os dois ficam fora do git.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run migrar` | aplica `supabase/migrations` no Supabase, em ordem, sem repetir |
| `npm run teste:banco` | testes das regras de pedido, estoque e cupom (cada um desfaz o que gravou) |
| `npm run semente` | categorias e produtos iniciais |
| `npm run produto -- arquivo.json` | cria ou atualiza produto (formato em `scripts/_catalogo.mjs`) |
| `npm run admin -- email "Nome" senha [operador]` | dá acesso ao painel |
| `npm run exemplo -- --sim-estou-no-banco-de-teste` | pedidos fictícios (`--apagar` remove) |

## Regras

- Dinheiro sempre em centavos; o preço que vale é o do banco.
- Tudo que mexe em estoque e dinheiro roda nas funções SQL (`criar_pedido`, `confirmar_pagamento`,
  `cancelar_pedido`, `mudar_status`), chamadas só pelo servidor.
- O site (anônimo) só lê o catálogo ativo e a configuração pública.
