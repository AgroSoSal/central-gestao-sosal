# Compras — conferência financeira e condições especiais

## Objetivo

Conferir as regras de previsão financeira frente à planilha Zacarini, tratar condições de pagamento inequívocas e permitir ao comprador identificar, sem inventar vencimentos, os itens cuja condição exige intervenção no SISCOM.

## Referência e limites

- `Pedidos de Compra`: K = I × J, M = I − L, N = M × J; chegada P = MAX(data do pedido, data-base) + B6 (7 dias); vencimento = P + prazo explícito, máximo de 10 parcelas; B7 = 30 dias se condição vazia ou pagamento no cartão. O usuário pode informar a chegada no Follow-up.
- A aprovação operacional não é a decisão financeira padrão da planilha: em branco compõe apenas a **simulação**; Segurar/Cancelar não geram parcelas.
- Despesas do grupo/subgrupo `5.` não podem ser somadas novamente à linha de Compras do Fluxo de Caixa. A RPC disponível não retorna a classificação. **Não produzir valor líquido de caixa nem prometer deduplicação enquanto não houver fonte autorizada e reconciliada.**
- Não alterar banco, RPCs, dados de pedidos, histórico, autenticação, perfis ou integração SISCOM. Não publicar nesta etapa: `AGENTS.md` exige autorização específica.

## Abordagens consideradas

1. **Aprimorar cálculo e auditoria somente no ERP** (escolhida para a etapa autorizada): mantém a segurança e permite diagnosticar condições inválidas, mas não resolve a classificação que falta à consulta.
2. Criar RPC read-only com subgrupo e agregação no banco: permitiria excluir grupo 5 e melhorar desempenho; requer alterar Supabase e autorização específica, hoje vedada.
3. Inferir subgrupo de fornecedor/descrição: rejeitada, pois inventa classificação financeira e pode duplicar despesas.

## Comportamento aceito

- Interpretar dias explícitos como `30/60/90`, `30d/60d`, `30 dias / 60 dias`, até 10 parcelas. Números sem indicação de dias adicional continuam contados como dias, tal como nas colunas R:AA.
- Aplicar B7 somente à condição vazia ou descrições inequívocas de cartão/crédito, acompanhadas de aviso visível. Não presumir datas para `6x`, `CARTÃO DE DÉBITO`, `BONIFICAÇÃO`, `À VISTA` e textos ambíguos.
- Fornecer lista de exceções da carteira inteira já consultada, com filial, pedido, produto, condição e saldo pendente; limitar visualização inicial e deixar explícito o número total, sem apresentar valor não programado como caixa projetado.
- Conferir datas, distribuição de centavos, entregas parciais e estados de decisão em testes que reproduzam as fórmulas de referência.

## Critérios de aceite

- Condições especiais aceitas geram vencimentos determinísticos; ambíguas não geram parcelas.
- Lista de exceções aparece após a consolidação integral, mesmo com paginação na tabela de detalhe.
- Os valores não reconciliados e a ausência de classificação `5.` continuam explícitos; nenhuma gravação externa é realizada.
- Testes, typecheck, lint e build passam antes de encaminhar publicação.
