# Previsão financeira de pedidos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax. O AGENTS.md proíbe commits, migrations e deploy nesta etapa; tais passos são omitidos.

**Goal:** Calcular e apresentar as parcelas financeiras pendentes das compras nas próximas 26 semanas, reproduzindo as regras da Zacarini sem alterar Supabase.

**Architecture:** Um serviço puro de domínio interpreta as condições de pagamento e calcula vencimentos por produto com base no saldo conciliado e na decisão. Uma página Next.js protegida usa as RPCs de leitura já existentes e exibe projeções por lote, com links do módulo atual.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind, Supabase RPC existente, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-compras-previsao-financeira-design.md`

## Global Constraints

- Sem alteração do Supabase, da origem SISCOM/RPA ou de dados reais.
- Sem commit, push ou deploy sem autorização posterior.
- Padrão financeiro AP vazio não é aprovação operacional.
- Não incluir dados incompletos como zero financeiro.
- Valores referem-se a um lote paginado, não ao total global.

## Review Focus

- Condição `30/60/90`, vazia, textual inválida ou com mais de 10 vencimentos.
- Chegada prevista informada por fornecedor antes da data-base e pedido com data futura.
- Compra parcialmente recebida, totalmente recebida e registros sem saldo conciliado.
- Sem decisão, Aprovado, Segurar e Cancelar, sem confundir status de pagamento.
- Valores com centavos e parcelas fora das 26 semanas.

---

### Task 1: Serviço de projeção financeira

**Files:**
- Create `src/domains/compras/domain/purchase-payment-forecast.ts`
- Create `src/domains/compras/domain/purchase-payment-forecast.test.ts`

**Interfaces:**
- Exportar `forecastPurchasePayments(input: PurchasePaymentInput): PurchasePaymentForecast` e `groupForecastByWeek(forecasts: PurchasePaymentForecast[], baseDate: string, weeks?: number): ForecastWeek[]`.
- `PurchasePaymentInput` recebe data, condição, pendência, decisão e previsão do Follow-up.
- `PurchasePaymentForecast` distingue `included`, `status`, `estimatedArrival`, `dueDates`, `installments`, `amountOutsideHorizon` e `issue`.

- [ ] Criar testes de todas as fórmulas e exceções, incluindo 85,01 reais/3 parcelas e valor 0 por decisão Segurar/Cancelar.
- [ ] Executar os testes e observar falha pela ausência do serviço.
- [ ] Implementar cálculo puro, datas em UTC e distribuição de centavos.
- [ ] Executar testes e observar sucesso.

### Task 2: Página protegida e visão de 26 semanas

**Files:**
- Create `src/app/compras/previsao/page.tsx`
- Create `src/app/compras/previsao/page.test.tsx`
- Create `src/components/compras/payment-forecast-table.tsx`

**Interfaces:**
- Consome o serviço de Task 1 e as RPCs `fn_listar_pedidos_compra_conciliados`, `fn_listar_decisoes_compra`, `fn_listar_followup_compras`.
- Preserva busca, filial, intervalo e página, mostrando limite de 50 registros.

- [ ] Criar testes de interface (cálculo de aprovados, exclusão de segurados, aviso de falha, lote e autorização).
- [ ] Executar os testes e observar falha inicial.
- [ ] Implementar o painel e tabela responsiva de parcelas.
- [ ] Executar testes e observar sucesso.

### Task 3: Navegação, registro de regras e verificação

**Files:**
- Modify `src/app/compras/page.tsx`
- Modify `src/app/compras/gerenciar/page.tsx`
- Modify `src/app/compras/follow-up/page.tsx`
- Modify `src/domains/compras/domain/rules/registro.md`

- [ ] Testar e adicionar links para a nova página, sem reconfigurar autenticação.
- [ ] Registrar regras COMP-022 em diante, com fonte e limites da projeção.
- [ ] Rodar teste completo, lint, TypeScript e build.
- [ ] Fazer revisão final de segurança, dados ausentes e ausência de mudanças no Supabase.
