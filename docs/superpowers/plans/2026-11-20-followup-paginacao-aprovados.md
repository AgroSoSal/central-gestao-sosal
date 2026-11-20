# Follow-up paginado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Corrigir a seleção e a paginação de Follow-up para abranger todos os itens aprovados com saldo pendente.

**Architecture:** Nova função SQL `public.fn_listar_followup_pendentes` filtra decisões e calcula saldos antes da paginação, retornando campos compatíveis com a tela. A página Next.js usa a nova consulta, preservando a RPC de histórico existente.

**Tech Stack:** PostgreSQL/Supabase, Next.js 16, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-followup-paginacao-aprovados-design.md`

## Global Constraints

- Não alterar `public.fn_listar_pedidos_compra_conciliados`, RPA, dados ou jobs.
- Autorização Master ativa obrigatória; não expor leitura ao `anon`.
- Somente nova RPC read-only, sem `REFRESH` e com limites de consulta.
- Publicar uma única vez após testes, preservando mudanças locais anteriores.

## Review Focus

- Sem aprovações: zero itens e nenhuma varredura desnecessária.
- `Já pago` com pendência continua elegível, mas não vira parcela nova.
- Item sem quantidade/custo confiável não vira pendência fictícia.
- Filtros, página depois da última e ordenação estável.
- Falha de autorização ou tempo de resposta não libera informações.

---

### Task 1: Teste de contrato da página

**Files:** `src/app/compras/follow-up/page.test.tsx`, `src/app/compras/follow-up/page.tsx`

**Interfaces:** RPC `fn_listar_followup_pendentes({p_busca,p_loja,p_inicio,p_fim,p_pagina,p_tamanho,p_codigos_genericos})`, resultado com `total_itens` global e campos `ManagementPurchaseItem`.

- [ ] Escrever testes para lote filtrado, paginação pelo total elegível e erro de consulta nova.
- [ ] Rodar Vitest específico e observar a falha esperada.
- [ ] Trocar o fluxo antigo de decisões depois da página pela RPC nova, preservando a consulta ao histórico.
- [ ] Rodar testes específicos até passar.

### Task 2: RPC read-only filtrada e paginada

**Files:** `docs/compras/fn_listar_followup_pendentes_20261120.sql`

**Interfaces:** Função SQL com a assinatura acima, linhas elegíveis e `total_itens`, grant `authenticated` e checagem Master.

- [ ] Conferir função de conciliação existente, índices e plano de acesso, sem `EXPLAIN ANALYZE` pesado.
- [ ] Escrever SQL idempotente preservando integralmente a conciliação original e limitar execução.
- [ ] Verificar o SQL e aplicar a função isoladamente no Supabase após revisão de segurança/performance.
- [ ] Validar existência, privilégios, ausência de resultados sem autenticação e contagem atual, sem escrita.

### Task 3: Regressão e publicação

**Files:** Testes, página, SQL e a correção visual já validada de `Já pago`.

- [ ] Executar Vitest completo, `tsc`, ESLint, `npm run build` e `git diff --check`.
- [ ] Revisar diff e confirmar que nenhuma fonte de dados original foi alterada.
- [ ] Fazer um commit, enviar para `main` autorizada e confirmar deploy de produção na Vercel.
- [ ] Verificar rota publicada e relatar limitações do teste com dados reais quando não houver pedidos aprovados.
