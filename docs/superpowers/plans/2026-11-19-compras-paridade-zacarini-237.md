# Paridade de Compras — Zacarini 2.3.7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use TDD e não pressupõem autorização para modificar produção.

**Goal:** Conferir a paridade do rateio global 90/10 com a Zacarini 2.3.7, modernizar verificadores e registrar diferenças reais do orçamento final sem liberar compras sem fontes homologadas.

**Architecture:** Funções puras em `src/domains/compras/domain/` calculam orçamentos, consumidas pelas telas Next.js. Os valores operacionais continuam exclusivamente no Supabase, sem leitura de Excel em runtime.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Supabase.

**Spec:** `docs/superpowers/specs/2026-11-19-compras-paridade-zacarini-237-design.md`

## Global Constraints

- Alterações de Supabase estão autorizadas pelo usuário em 19/11/2026, mas só devem ocorrer após revisão e com fonte validada; esta correção da OTB não exige migração ou alteração de dados.
- O usuário autorizou commit/publicação em 19/11/2026; verificar o destino e os testes antes de publicar.
- Valores ausentes nunca liberam compras automaticamente.
- Base Excel 2.3.7 usada apenas para fórmula e teste, sem importar dados históricos para o app.

## Review Focus

- A matéria-prima da linha especial 173 participa **uma vez** dos 90% do comprador e 10% da diretoria na governança global da OTB.
- O teto global prioriza MP antes de mercadorias, sem duplicar a MP em subgrupos comerciais.
- Com caixa 200, MP 100 e mercadorias 100, `releasedTotal=200`, `buyerBudget=180` e `directorReserve=20`.
- `Verba Comprador!C9` não equivale automaticamente a `OTB!P30`: depende dos cortes e proteções da planilha.
- Sem mercadorias elegíveis, a MP ainda participa do rateio global.

### Task 1: Validar rateio global e distinguir orçamento final

**Files:**
- Test: `src/domains/compras/domain/otb-calculation.test.ts`
- Modify: `src/domains/compras/domain/rules/registro.md`

**Interfaces:** `calculateOtb(input: OtbInput): OtbResult`; `OtbMonth.buyerBudget` e `OtbMonth.directorReserve` representam `OTB!P30/Q30`, isto é, governança **global** incluindo `mpReleased` uma única vez.

- [x] Conferir `OTB!C173`, `T173`, `P30/Q30`, `Verba Comprador!E145` e `C9` no arquivo.
- [x] Escrever teste com caixa 200, MP 100 e mercadorias 100, exigindo comprador 180, reserva 20 e verba total liberada 200.
- [x] Preservar a base correta `releasedTotal` após revisão cruzada; não alterar a lógica original de `calculateOtb`.
- [x] Registrar a distinção de indicadores na regra COMP-043 e relatório de fechamento.
- [ ] Integrar/verificar os cortes adicionais de `Verba Comprador!C9` com os parâmetros oficiais necessários.

### Task 1b: Atualizar verificação legada

**Files:** `scripts/verify-otb.mjs` e `src/components/compras/stock-liquidation-dashboard.test.tsx`.

- [x] Reproduzir falha do verificador legado que usava `buyerShare=0.85` (versão 2.2.24).
- [x] Adaptar caso e expectativas de 90/10 com cenário explícito de MP.
- [x] Isolar corretamente o teste React com `cleanup` entre casos para evitar falhas globais de ambiente.
- [x] Rodar verificador (8/8), Vitest global (259/259), typecheck, ESLint (0 erros; 3 avisos preexistentes) e build (19 páginas geradas).

### Task 2: Testar a equivalência restante e separar bloqueios de dados

**Files:**
- Source: `Gestão Zacarini - Painel 2.3.7.xlsx` (apenas leitura fora do repositório).
- Inspect: `src/app/compras/otb`, `src/app/compras/atendimento`, `docs/compras/AUDITORIA-FUNCIONAL-ZACARINI-237-2026-11-19.md`.

- [x] Conferir as fórmulas-chave de aprovações, parcelas, verbas e fluxo de caixa sem sobrescrever as regras já documentadas.
- [x] Distinguir lacunas corrigíveis no código de dados operacionais faltantes no Supabase.
- [x] Reportar bloqueios de alçada, parâmetros futuros e execução SISCOM que precisam de autorização adicional.

### Task 3: Homologação e publicação

- [x] Recebida autorização explícita para alterações necessárias no Supabase e publicação posterior à validação.
- [ ] Obter cenário financeiro e parâmetros técnicos homologados para OTB e MP; não inferir aprovação do Excel.
- [ ] Executar testes de produção com acesso Master e confirmar atualizações após a publicação.

**Diagnóstico adicional (19/11/2026):** `painel.alex_extratos_movimentos` contém 79.303 registros e `painel.alex_extratos_saldos` contém 1.783; há 10 contas ativas, mas só 5 têm posição na data máxima de 18/11/2026, sem conciliação registrada nessa data. `painel.alex_projecao_12m` e `public.otb_premissas_financeiras_12m` permanecem vazias. A view `painel.v_alex_saldo_abertura_fluxo` exige todas as contas ativas na mesma data e conciliadas. Não marcar conciliações ou aprovar cenário automaticamente.
