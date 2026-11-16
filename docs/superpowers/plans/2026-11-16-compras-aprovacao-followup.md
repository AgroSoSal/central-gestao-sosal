# Compras — Fila e Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) for tracking.

**Goal:** Exibir aprovação operacional explícita, gestão tabular e follow-up para compras aprovadas ainda não entregues.

**Architecture:** Camada de domínio separa decisão operacional da regra financeira legada. Páginas autenticadas paginam a mesma RPC reconciliada; componentes cliente controlam seleção/formulários. SQL de persistência de follow-up fica preparado em documento sem aplicação ao banco.

**Tech Stack:** Next.js 16, TypeScript, React, Vitest, Supabase Auth/RPC, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-16-compras-aprovacao-followup-design.md`

## Global Constraints

- Em 16/11/2026 o usuário autorizou expressamente a aplicação do SQL do Follow-up e um único commit/push/deploy, excepcionando as restrições gerais do AGENTS.md somente para esta entrega.
- Nunca usar valores de planilha como dados reais; preserve a regra financeira `AP vazio = Aprovado`.
- Só apresentar saldo reconciliado com NF e aprovação explicitamente registrada.

## Review Focus

- Quantidade pendente nula/NaN/zero nunca deve gerar follow-up: testar no domínio.
- `Segurar`/`Cancelar` não pertencem aos aprovados: testar no domínio e na fila.
- Aprovação em branco pode ser salva como aprovação explícita: testar no editor.
- Falha na consulta de decisões não pode mostrar pedidos como aprovados: testar página.
- RPC de follow-up ausente não pode gerar salvamento fictício: testar erro do formulário.

---

### Task 1: Regras e decisão explícita

**Files:** `src/domains/compras/domain/purchase-decisions.ts`, `purchase-management.ts` e respectivos testes; `src/components/compras/purchase-decision-editor.tsx` e teste; registro de regras.

**Interfaces:** `operationalDecision(record)`, `requiresPurchaseManagement(item, decision)`, `isApprovedForFollowUp(item, decision)`.

- [x] Escrever testes para null → aguardando, decisão explícita, pendências e possibilidade de salvar Aprovado.
- [x] Executar Vitest e confirmar falhas esperadas.
- [x] Implementar regra sem mudar `forecastIncludesDecision`.
- [x] Executar Vitest e confirmar verde.

### Task 2: Gestão em tabela e filtros

**Files:** `src/app/compras/gerenciar/page.tsx`, testes; `src/components/compras/management-table.tsx`, testes.

**Interfaces:** items da RPC conciliada + mapa de decisões para tabela; editor de decisão fica num painel após seleção.

- [x] Escrever teste da tabela e abas operacionais.
- [x] Confirmar teste vermelho.
- [x] Implementar tabela selecionável e filtros, mantendo URLs e paginação de origem.
- [x] Confirmar testes verdes.

### Task 3: Follow-up e contrato de persistência

**Files:** `src/app/compras/follow-up/page.tsx`, testes; `src/components/compras/follow-up-table.tsx`, testes; `docs/compras/followup_pedidos_compra.sql`.

**Interfaces:** SQL prevê `fn_listar_followup_compras(jsonb)` e `fn_salvar_followup_compra(...)`; UI só habilita persistência se RPC estiver ativa.

- [x] Escrever testes para aprovados com pendência, parcial, sem aprovação e erro de RPC.
- [x] Confirmar testes vermelhos.
- [x] Implementar tela, formulário, avisos e SQL aplicado após autorização adicional.
- [x] Confirmar testes verdes.

### Task 4: Navegação e verificação

**Files:** `src/app/compras/page.tsx`, eventuais testes/ajustes.

- [x] Acrescentar acesso claro ao Follow-up e à gestão.
- [x] Executar `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [x] Revisar alterações, aplicar nova estrutura autorizada sem tocar SISCOM e verificar a publicação.
