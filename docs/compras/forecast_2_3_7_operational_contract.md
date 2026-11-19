# Caixa 13 semanas / Projeção 12M — Zacarini 2.3.7

## Origem e autonomia

- Importação **única** e rastreável das premissas identificadas da `Gestão Zacarini - Painel 2.3.7.xlsx` para `public.compras_dashboard_config_237`. As entradas existentes foram mantidas; novas células são inseridas com chave `(codigo,competencia)` sem sobrescrever alterações homologadas.
- `scripts/extract-dashboard-forecast-seed.py` gera `dashboard_forecast_seed_237.sql` do arquivo de referência; **o sistema em execução nunca abre o XLSX**.
- `dashboardReference` aceita apenas célula identificada, versão `2.3.7` e status válido. Seeds usam `situacao='referencia'`, nunca `homologado`.

## Relação com as fórmulas de referência

| Planilha | Motor atual |
|---|---|
| `Fluxo de Caixa!B9`, `G206:G209`, `I206:I209` | 15% à vista; 85% parcelados em 3/6/12/20 semanas, ponderados por faixas |
| `Receber Vencidos!A5:B19`, `L:O`, `G13`; `Fluxo de Caixa!B11`, `B25`, `B38` | recuperação **fixa** de 1,5%/semana sobre o **principal original** de títulos nas classes 1/2/3; exclui empresas do grupo, PERDAS, acima de 1825 dias e jurídico. A classificação da planilha não possui ajustes manuais preenchidos. Fonte ERP: `fn_compras_dashboard_receber_recuperavel_237` com `painel.receber.vlr_titulo`, nunca `vlr_liquido`. |
| `Fluxo de Caixa!B12`, `B15`, `B52:B53`, `B75`, `B78:B79` | somente salários B75 no dia 5, encargos B15 distribuídos semanalmente em 12/52 e parcelas desiguais do 13º nas datas 30/11 e 18/12 |
| `Fluxo de Caixa!B33:B34`, `B225`; `Metas de Vendas!D54:O54`; `Premissas 12M!E499:P499` | visão de 13/26 semanas: mês **comercial 26–25**, meta ×90% + venda adicional de Saúde, proporcional aos dias daquele mês comercial |
| `Fluxo de Caixa!B114:B115` | despesas operacionais e tributos proporcionais ao faturamento previsto |
| `Projeção 12M!C81:N81`, `C181:N181`, `C281:N281` | faturamento projetado de 12 meses por cenário (90%, 100%, histórico) |
| `Projeção 12M!C83:N86` etc. | entregas previstas por linha e cenário |
| `Projeção 12M!C88:N91` | CMV de referência por linha, escalado conforme entregas dos demais cenários |
| `Premissas 12M!G77:G80` | pagamentos das compras novas em 47/73/78/146 dias |
| `Projeção 12M!C98:C127` | necessidade de reposição para convergir ao DDE-alvo, a partir do estoque SISCOM atual |
| `Projeção 12M!C801:C807` | **Pior caso correto**: mantém o plano de compras/CMV e subtrai os recebimentos futuros correspondentes à venda extra de Saúde, conforme curva de 15% à vista e parcelas a prazo |
| `Pedidos de Compra!B5:B7`, `P:AK` | sete dias de chegada padrão sobre **pedidos selecionados** e pagamento parcelado; **ainda não aplicado** indiscriminadamente à carteira de pedidos do ERP |
| `Fluxo de Caixa` 13/26 semanas e `Projeção 12M!C159:N159` | saldos corridos, menores saldos e saldos mensais por cenário |

Recebíveis e fornecedores já registrados vêm de `fn_compras_dashboard_agenda_26s_237` e `fn_otb_agenda_contratada_12m_237`, com saldo bancário-base de `fn_otb_extratos_posicao_237`. As agregações por prazo usam buckets semanais/mensais: os valores mensais são distribuídos por dia para cálculo de calendário; os semanais são utilizados para a visão de 13/26 semanas. O mês corrente considera **apenas os dias futuros**, mas a base bancária pode estar desatualizada.

### Correção de 19/11/2026 — juros de títulos vencidos

O campo `painel.receber.vlr_liquido` incorpora juros acumulados de títulos emitidos até nos anos 2000: R$ 320.642.006,46 no total vencido, contra **R$ 4.216.907,97 de principal original** nos mesmos 2.150 registros. A planilha tem a fórmula `Receber Vencidos!G13=SUMIFS(tbReceber[Valor do título (R$)],tbReceber[Entra no fluxo?],"Sim")`, e usa somente cobrança normal (até 90 dias), intensiva (até 365 dias) e Kohl (até 1.825 dias), exceto portadores PERDAS e empresas do grupo. Aplicadas aos dados atuais do Supabase, essas condições identificam **780 títulos recuperáveis, R$ 2.796.165,23**; 1,5%/semana equivale a R$ 41.942,48, e não R$ 4.809.630,10. A base da planilha (carga 30/10) era R$ 2.456.849,12; diferenças de período são esperadas.

O servidor valida todas as seis filiais, contagens, principal e ausência de registros sem valor antes de projetar. Uma falha desse RPC faz a simulação ficar indisponível (não tenta usar o campo inflado). A dashboard também mostra carteira vencida e percentual vencido usando **principal**, sem confundir juros históricos com créditos recuperáveis.

## Diferenças ainda relevantes da planilha

1. O saldo bancário comum da importação foi conferido aritmeticamente, mas não tem homologação de conciliação. A data-base pode anteceder a consulta.
2. A aba de pedidos do Excel contém uma **seleção** (940 itens, com pedidos em diversos estados), enquanto o Supabase tem **4.864 itens pendentes** em 19/11/2026, sem nenhuma previsão de entrega confirmada no follow-up: aplicar a chegada padrão de sete dias a todos anteciparia aproximadamente **R$ 62,56 milhões**. O novo RPC `fn_compras_dashboard_pedidos_qualidade_237` deixa explícitos totais, itens sem classificação de linha e sem previsão; não cria entrada fictícia nem verba de compra. É necessária a conferência de quais pedidos estão de fato em trânsito e suas condições.
3. A carteira de contas a pagar importada não traz a classificação de fluxo (`mercadoria`, `matéria-prima`, `tributos`, `operação` etc.). A Zacarini desconta essas rubricas do orçamento projetado para evitar **pagamento duplicado**. Reproduzir essa deduplicação requer classificação confiável por título; sem ela, falta conciliação.
4. Os dados disponíveis não reproduzem por completo matéria-prima sazonal, estoque parado/liquidação, investimentos, empréstimos e despesas orçadas por categoria. A projeção parcial pode tanto superestimar como subestimar caixa.
5. A curva de compra do sistema usa prazo em dias completos, enquanto a planilha distribui parte dos pagamentos entre meses de 30 dias. A meta de DDE aproxima o movimento de 12 meses sem descontar estoque parado, pois falta base conciliada.
6. Não é uma comparação numérica do saldo final do arquivo: o workbook tem dados e datas-base próprios, e o ERP utiliza as importações correntes do SISCOM/Supabase.

## Regra de segurança

**NUNCA** tratar saldo, piso de caixa ou compra calculada aqui como cenário financeiro homologado. `authorizesPurchases` sempre é `false`. A autorização de OTB continua separada e deve exigir as premissas financeiras, a conciliação e o procedimento de aprovação existentes.
