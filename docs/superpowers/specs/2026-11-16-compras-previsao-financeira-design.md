# Previsão de pagamentos dos pedidos de compra — design aprovado

**Aprovação:** Euller, 16/11/2026. Implementar primeiro a previsão financeira no ERP, sem alterar o Supabase, deixando a integração definitiva com Caixa e OTB para a etapa seguinte.

## Objetivo e alcance

- Usar exclusivamente os pedidos e recebimentos já conciliados do SISCOM/Supabase, as decisões já gravadas e as previsões de entrega do Follow-up.
- Exibir os compromissos **ainda pendentes de entrega** em até 10 parcelas, seus vencimentos e a distribuição das próximas 26 semanas.
- Preservar a distinção entre aprovação **operacional explícita** e o padrão financeiro da planilha: decisão vazia é contabilizada nas projeções, mas aparece como **aguardando aprovação operacional**.
- `Segurar` e `Cancelar` não integram o valor projetado; `Cancelar` não cancela o pedido no SISCOM.
- O valor a parcelar é somente o **saldo pendente conciliado**, nunca o valor nominal de um pedido parcialmente entregue.
- Sem alteração de schema, RPC, RPA, registros ou credenciais. Nenhum commit, push ou deploy nesta etapa (AGENTS.md).

## Fórmulas da Zacarini reproduzidas

- `Pedidos de Compra!M12 = I12-L12`; `N12 = M12*J12`: aproveitar valores pendentes calculados pela conciliação, sem recalcular a NF na interface.
- `P12 = MAX(E12,$B$5)+$B$6`: previsão de chegada = máximo entre data do pedido e data-base + **7 dias**; previsão real informada no Follow-up, quando existente, tem prioridade nesta interface.
- `Q12 = COUNT(R12:AA12)` e `AB12 = P12+R12`: separar até **10** dias de condição de pagamento (ex.: `30/60/90`) e calcular vencimentos a partir da chegada.
- `AL12 = IF(OR(Q12=0,AP12="Segurar",AP12="Cancelar",AP12="Já pago"),0,N12/Q12)`: cotas do saldo pendente em parcelas; ratear centavos sem perder valor.
- Período da aba `Fluxo de Caixa`: próximas **26 semanas**. Exibir valores fora desse horizonte separadamente, sem descartá-los.
- Se condição vier vazia, aplicar o padrão de **30 dias** (`Pedidos de Compra!B7`) com aviso. Condições textuais não reconhecidas (`BONIFICAÇÃO`, etc.) **não geram vencimentos presumidos**, mas exibem o valor para conferência.

## Interface

- Nova página `/compras/previsao`, acessível por Compras, Gerenciar e Follow-up.
- Painel com indicadores do lote conciliado, calendário das 26 semanas e lista auditável de parcelas, origem da previsão, situação da decisão e exceções.
- Filtrar por busca, filial, datas de pedido e paginação seguindo a RPC atual; informar **claramente** que os totais representam apenas o lote retornado (até 50 itens), não a carteira inteira.
- Não exibir zeros fictícios quando RPC de conciliação/decisões falhar. Se a RPC do Follow-up falhar, não presumir uma previsão de entrega informada; usar a previsão calculada e identificar o motivo.

## Alternativas e decisão

1. **Previsão somente de leitura usando RPCs existentes — escolhida:** implementação segura já nesta etapa, sem invadir a origem.
2. Integração transacional com caixa/OTB — adiada, pois esses módulos ainda não existem e a alteração do Supabase está fora do escopo autorizado.

## Não inclui

- Saldo bancário, caixa disponível, travas reais de caixa/OTB, gravação de títulos a pagar, emissão/cancelamento no SISCOM, comunicação com fornecedores ou atualização de dados do Supabase.
- Os dados preenchidos na planilha Zacarini: apenas as regras e fórmulas são referência.

## Validação

- Testes unitários para datas, condições, parcelas, arredondamento, decisões, parciais, horizon e condições inválidas.
- Testes de interface para acesso, lotes, erros da RPC, integração de decisão/Follow-up e comportamento sem dados.
- Typecheck, testes, lint e build local; sem publicar.
