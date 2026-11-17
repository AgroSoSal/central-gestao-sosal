# OTB 12M Cash Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute one task at a time, tests RED then GREEN.

**Goal:** Implementar a trava automática de pior caso da Projeção 12M e preparar a integração segura às fontes financeiras do Supabase sem inventar premissas.

**Architecture:** Serviço puro de caixa com 12 competências e três liberações; contrato separado para o pipeline de cenários financeiros; dashboard só recebe resultados oficiais se todos os insumos estiverem auditados.

**Tech Stack:** TypeScript, Node 24/Vitest, PostgreSQL/Supabase Auth, Next.js.

**Spec:** `docs/superpowers/specs/2026-11-17-otb-projecao-12m-automatica-design.md`

## Task 1 — Conferência do estado atual e cadeia de dependências

- [x] Confirmar o projeto Supabase e tabelas de origem disponíveis.
- [x] Confirmar ausência da Projeção 12M e premissas versionadas.
- [x] Identificar a fórmula de caixa pior caso (`B638:B640`, `B652:D652`).
- [x] Preservar RPA/SISCOM e permissão Master.

## Task 2 — Motor puro de liberação financeira

**Files:** `src/domains/compras/domain/otb-cash-projection.ts`, `.test.ts`, `scripts/verify-otb-cash.mjs`.

- [x] Testar prioridade mês 1 → 2 → 3, folga do pior caso e caixa negativo.
- [x] Executar RED.
- [x] Implementar fatores de liberação e tetos dos três meses com validação de 12 posições.
- [x] Executar GREEN e comparar à fotografia de `Projeção 12M` (6/6 valores).

## Task 3 — Contrato de automação e bloqueio de incompletude

- [x] Documentar campos financeiros de origem e premissas ainda ausentes.
- [x] Criar RPC Master de histórico comercial, sem publicar dados de exemplo.
- [x] Verificar `anon` sem EXECUTE e execução sem JWT rejeitada (`42501`).
- [x] Não publicar os tetos até haver entrada financeira 12M completa e regressão contra XLSX.
- [x] Conectar a RPC à tela com falha fechada e contabilização de linha não classificada.
- [ ] Completar a cadeia dos três cenários de caixa, pagamentos, receitas e premissas versionadas.
- [ ] Homologar a projeção automática contra o XLSX e publicar no GitHub/Vercel quando autorizado.

## Verificação

Rode testes do OTB e da trava, incluindo casos sintéticos de caixa apertado. Compare os três fatores e tetos reais guardados no XLSX. Não afirmar build da aplicação sem dependências Next/Vitest disponíveis.

**Andamento em 17/11/2026:** 27 testes de domínio/segurança passaram; RPC aplicada no Supabase e painel atualizado no snapshot local. O esquema legado não foi modificado. O módulo ainda não possui insumos suficientes para emitir verba automática real, por isso continua bloqueando a aprovação financeira. O estado de publicação do código deve ser consultado no histórico GitHub/Vercel.
