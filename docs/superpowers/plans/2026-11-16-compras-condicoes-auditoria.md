# Conferência Financeira de Compras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmonizar condições financeiras explícitas com a Zacarini e tornar os itens ambíguos auditáveis, sem alterar o banco.

**Architecture:** Ampliação pontual do domínio `purchase-payment-forecast`, enriquecimento do resultado da consolidação com amostras de exceções e exibição na tela global. Manter a RPC atual e a restrição contra fluxo de caixa deduplicado.

**Tech Stack:** TypeScript, React, Vitest, Supabase RPCs existentes.

**Spec:** `docs/superpowers/specs/2026-11-16-compras-condicoes-auditoria-design.md`

## Global Constraints

- `AGENTS.md`: não alterar Supabase, não executar migrations, não publicar sem autorização, não inventar regras.
- Condições ambíguas não geram datas ou parcelas fictícias.

## Review Focus

- Cartão com informação explícita de parcelamento: não presumir 30 dias.
- Condições com cada parcela sufixada por `d`/`dias`: calcular datas certas.
- Condições com mais de 10 parcelas: apresentar como exceção.
- Carteira paginada com exceções além da primeira página: total e lista consistentes.
- Valores de pedido sem reconciliação: não somar em valor projetável.

### Task 1: Interpretador de condições inequívocas

**Files:** `src/domains/compras/domain/purchase-payment-forecast.ts`, `src/domains/compras/domain/purchase-payment-forecast.test.ts`, `src/domains/compras/domain/rules/registro.md`.

- [x] Escrever casos vermelhos `30d/60d`, `30 dias / 60 dias`, `CARTÃO` e `CARTÃO 6X`.
- [x] Executar `npx vitest run src/domains/compras/domain/purchase-payment-forecast.test.ts` e observar falhas esperadas.
- [x] Atualizar `paymentDays` no domínio para reconhecer apenas valores explícitos seguros (inclusive débito como exceção).
- [x] Reexecutar a suíte focada; documentar a regra no registro.

### Task 2: Lista consolidada de condições a conferir

**Files:** `src/domains/compras/domain/purchase-forecast-consolidation.ts`, `.test.ts`, `src/components/compras/global-payment-forecast.tsx`, `.test.tsx`.

- [x] Testes vermelhos para somatório de defaults, exceções além da página 1, limite de itens da lista e ausência de valores fictícios.
- [x] Ampliar DTO com informações existentes da RPC (fornecedor/filial/pedido/produto/condição/valor), sem novas consultas ou dados gravados.
- [x] Exibir tabela dark de conferência após a leitura completa e indicador dos defaults; manter erro fail-closed.
- [x] Reexecutar testes focados e completos.

### Task 3: Verificação de equivalência e handoff

**Files:** regra registrada e spec.

- [x] Auditar fórmulas e casos de referência em testes.
- [x] Executar `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [x] Revisar diferenças, não publicar nem modificar banco sem autorização específica.
