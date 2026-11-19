# Caixa 13 semanas / Projeção 12M — Zacarini 2.3.7

## Origem e autonomia

- Importação **única** e rastreável de 245 premissas da `Gestão Zacarini - Painel 2.3.7.xlsx` para `public.compras_dashboard_config_237`. As 24 entradas anteriores foram mantidas.
- `scripts/extract-dashboard-forecast-seed.py` gera `dashboard_forecast_seed_237.sql` do arquivo de referência; **o sistema em execução nunca abre o XLSX**.
- `dashboardReference` aceita apenas célula identificada, versão `2.3.7` e status válido. Seeds usam `situacao='referencia'`, nunca `homologado`.

## Relação com as fórmulas de referência

| Planilha | Motor atual |
|---|---|
| `Fluxo de Caixa!B9`, `G206:G209`, `I206:I209` | 15% à vista; 85% parcelados em 3/6/12/20 semanas, ponderados por faixas |
| `Fluxo de Caixa!B11` | recuperação da carteira vencida: 1,5%/semana, aplicada ao saldo remanescente |
| `Fluxo de Caixa!B12`, `B15`, `B18` | folha, encargos e duas parcelas do 13º de 2026 |
| `Fluxo de Caixa!B114:B115` | despesas operacionais e tributos proporcionais ao faturamento previsto |
| `Projeção 12M!C81:N81`, `C181:N181`, `C281:N281` | faturamento projetado de 12 meses por cenário (90%, 100%, histórico) |
| `Projeção 12M!C83:N86` etc. | entregas previstas por linha e cenário |
| `Projeção 12M!C88:N91` | CMV de referência por linha, escalado conforme entregas dos demais cenários |
| `Premissas 12M!G77:G80` | pagamentos das compras novas em 47/73/78/146 dias |
| `Projeção 12M!C98:C127` | necessidade de reposição para convergir ao DDE-alvo, a partir do estoque SISCOM atual |
| `Fluxo de Caixa` 13/26 semanas e `Projeção 12M!C159:N159` | saldos corridos, menores saldos e saldos mensais por cenário |

Recebíveis e fornecedores já registrados vêm de `fn_compras_dashboard_agenda_26s_237` e `fn_otb_agenda_contratada_12m_237`, com saldo bancário-base de `fn_otb_extratos_posicao_237`. As agregações por prazo usam buckets semanais/mensais: os valores mensais são distribuídos por dia para cálculo de calendário; os semanais são utilizados para a visão de 13/26 semanas. O mês corrente considera **apenas os dias futuros**, mas a base bancária pode estar desatualizada.

## Diferenças ainda relevantes da planilha

1. O saldo bancário comum da importação foi conferido aritmeticamente, mas não tem homologação de conciliação. A data-base pode anteceder a consulta.
2. Os dados disponíveis não reproduzem por completo pedidos **a chegar**, matéria-prima sazonal, estoque parado/liquidação, investimentos, empréstimos, despesas orçadas por categoria e pagamentos já incluídos em outras rubricas. A projeção parcial pode tanto superestimar como subestimar caixa.
3. A curva de compra do sistema usa prazo em dias completos, enquanto a planilha distribui parte dos pagamentos entre meses de 30 dias. A meta de DDE aproxima o movimento de 12 meses sem descontar estoque parado, pois falta base conciliada.
4. Não é uma comparação numérica do saldo final do arquivo: o workbook tem dados e datas-base próprios, e o ERP utiliza as importações correntes do SISCOM/Supabase.

## Regra de segurança

**NUNCA** tratar saldo, piso de caixa ou compra calculada aqui como cenário financeiro homologado. `authorizesPurchases` sempre é `false`. A autorização de OTB continua separada e deve exigir as premissas financeiras, a conciliação e o procedimento de aprovação existentes.
