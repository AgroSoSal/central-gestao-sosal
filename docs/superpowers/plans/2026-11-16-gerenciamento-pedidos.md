# Gerenciamento de pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma tela dedicada que exibe apenas pedidos com atenção operacional, removendo a edição da tabela de consulta.

**Architecture:** Continuar usando as RPCs de conciliação e decisão existentes, sem mudar o Supabase. Um predicado de domínio independente define a fila; a página server-side consulta até 50 linhas e respectivas decisões, filtra e renderiza cartões com o editor existente. A consulta principal passa a expor um CTA para a nova rota.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase SSR, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-16-gerenciamento-pedidos-design.md`

## Global Constraints

- Dados históricos permanecem no Supabase/SISCOM; planilha apenas define regras.
- `SO SAL` deve ser exibido como Bandeirantes, sem alterar a chave `loja`.
- Perfil `master` ativo para consulta e escrita; falhas de conciliação/decisão não podem simular dados válidos.
- Sem cancelar no SISCOM e sem alterar OTB/caixa ou rotina RPA.
- Uma publicação única após lint, testes e build.

## Review Focus

- Recebido integralmente + Aprovado é excluído da fila.
- Recebido integralmente + Segurar/Cancelar é incluído.
- Sem decisão equivale a Aprovado, sem transformar erro de consulta em valor padrão.
- Saldo nulo/incompleto não é presumido como pendente; pode exigir atenção apenas se decisão especial.
- Paginação por lote não pode ser rotulada como total global de pendências.

---

### Task 1: Predicado de triagem de gestão

**Files:**
- Create: `src/domains/compras/domain/purchase-management.ts`
- Create: `src/domains/compras/domain/purchase-management.test.ts`

**Interfaces:** `requiresPurchaseManagement({quantidade_pendente,situacao_recebimento},decision:PurchaseDecision|null|undefined):boolean`.

- [ ] **Step 1:** Criar testes com todas as situações do Review Focus, incluindo `null` e zero.
- [ ] **Step 2:** Rodar `npx vitest run src/domains/compras/domain/purchase-management.test.ts` e verificar que falha.
- [ ] **Step 3:** Implementar `requiresPurchaseManagement` usando a decisão efetiva da regra de domínio.
- [ ] **Step 4:** Rodar o teste novamente e confirmar aprovação.

### Task 2: Nova página de gerenciamento

**Files:**
- Create: `src/app/compras/gerenciar/page.tsx`
- Reuse: `src/components/compras/purchase-decision-editor.tsx`

**Interfaces:** `/compras/gerenciar?busca=&loja=&inicio=&fim=&pagina=`; RPC `fn_listar_pedidos_compra_conciliados`, RPC `fn_listar_decisoes_compra` com limite de 50 chaves.

- [ ] **Step 1:** Renderizar login se não autenticado; recusar Master inválido via RPC existente.
- [ ] **Step 2:** Buscar 50 itens conciliados e suas decisões; se qualquer fonte falhar, exibir aviso sem fila presumida.
- [ ] **Step 3:** Exibir somente `requiresPurchaseManagement`, com cartões responsivos, edição visível, filtros e paginação por lotes.
- [ ] **Step 4:** Verificar visualmente a estrutura e links, incluindo estados vazios.

### Task 3: Simplificar a consulta e integrar navegação

**Files:**
- Modify: `src/app/compras/page.tsx`

- [ ] **Step 1:** Remover a consulta de decisões e o editor da tabela principal.
- [ ] **Step 2:** Adicionar botão destacado para `/compras/gerenciar` acima da listagem, mantendo filtros da consulta.
- [ ] **Step 3:** Rodar `npm run lint`, `npm test`, `npx tsc --noEmit`, `npm run build`.
- [ ] **Step 4:** Fazer um commit único, publicar no GitHub e verificar a implantação READY e HTTP 200 na Vercel.
