# Conferência do módulo Compras — Zacarini 2.3.7 (19/11/2026)

## Contrato de origem

- Planilha: `Gestão Zacarini - Painel 2.3.7.xlsx`, utilizada exclusivamente para extrair premissas e comparar fórmulas; nenhuma rota do ERP consulta Excel em tempo de execução.
- As fontes operacionais e metas versionadas vêm de Supabase; páginas de Compras consultam RPCs protegidas por Master ativo.
- **Nenhum valor simulado libera automaticamente pedidos**, pois a aprovação de OTB depende da conciliação de fontes reais, conferência gerencial e cálculo do pior cenário.

## Diferenças corrigidas e equivalências implementadas

| Referência na planilha | Regra conferida | Implementação | Situação |
|---|---|---|---|
| `OTB!R24` e `Verba Comprador!E20` | Comprador = verba × **90%**, reserva diretoria **10%**. O texto `Verba Comprador!A2` permanece desatualizado e diz 85%. A fórmula usa R24=90%. | `calculateOtb`, painel e testes de regressão ajustados a 90/10. | Corrigida, verba oficial ainda travada. |
| `Dashboard!D36:D39`, `Metas de Vendas!B4` | O valor de outubro não é a meta de novembro; `B4=2026-10-01` no arquivo auditado. | 132 metas 2026 de `Metas de Vendas!D26:O53` versionadas por linha/loja/mês. | Corrigida e conferida no banco: outubro R$ 10.150.589, novembro R$ 10.000.000. |
| `Metas de Vendas!D14`, `D17:D20`, `D7:D13` | Percentual acumulado considera metas do início do ano até o mês selecionado; não é somente a meta daquele mês. | `accumulatedSalesTarget`; velocímetro anual e % anuais por linha/loja. | Reproduzida quando todas as competências estão cadastradas. |
| `Metas de Vendas!A46:O49` | Cassilândia tem **meta futura de dezembro de R$ 650 mil**, mas não consta nas seis filiais operacionais Supabase. | Configuração `meta_loja_CASS` separada, sem inventar venda realizada nem filial. | Registrada como planejamento, não operação. |
| `DRE 2026!D8:D33` e `Orçamento 2027!D7:D25` | Grupos `Orc_Dados`, Tipo=`Projetado`; receita líquida=bruta+impostos; lucro bruto=líquida+CMV; EBITDA=bruto+despesas; lucro líquido=EBITDA+financeiras+outros tributos. | 216 linhas `dre_orcado` versionadas 2026–27; painel mostra orçamento do mês e acumulado; margens anuais ponderadas. | Orçado de referência disponível; realizado atual pendente de base contábil classificada. |
| `OTB!P188:U188` e `Plano de Estoque` | DDE individual por subgrupo, ponderado por CMV; não equivale ao DDE total da rede quando há grupos sem plano. | Painel lê `fn_compras_plano_estoque_237` do Supabase e mostra cobertura dos subgrupos válidos. | Parcial: 56 grupos parametrizados na fonte, sem assumir planos inexistentes. |
| `OTB!B7` | Horizonte de compra começa no mês seguinte ao início do fluxo. | Prévia de três meses na tela OTB usando motor 12M operacional, com corte de mês correto. | Simulação disponível; sem verba ou status “LIBERADO”. |

## Dados que impedem equivalência financeira e liberação de OTB

1. **Previsão real de chegada dos pedidos:** 4.864 itens com saldo pendente; nenhuma previsão de entrega gravada na tabela de follow-up em 19/11. Não aplicar o prazo de sete dias da planilha para todos os pedidos históricos: criaria entradas fictícias de estoque e contas a pagar.
2. **Conciliação por linha/subgrupo:** pedidos sem linha 1–4 e condições de pagamento incompletas exigem classificação/conferência do usuário. Travas da Zacarini `Pedidos de Compra!AP/AM` dependem dessa vinculação.
3. **Cenário oficial do pior caixa:** `painel.alex_projecao_12m` e sua visão homologada possuem zero linhas; cálculos do ERP são simulações. Precisam integrar despesas futuras classificadas, dívida, investimento, matérias-primas sazonais e aprovação financeira.
4. **Matéria-prima e produção própria:** `compras_producao_parametros_237` ainda não contém parâmetros aprovados; consumo e necessidade de MP não devem ser deduzidos sem a composição real do produto.
5. **DRE realizado:** Excel tem instantâneo de 2026, mas a apuração atual exige classificação/fechamento contábil do banco. O sistema não apresenta esse instantâneo histórico como realização atual.

Esses pontos são dependências de qualidade e homologação **de dados**, não ligação com Excel. A importação RPA continua sendo a via operacional única, e metas orçadas são independentes da atualização de extratos. A simulação nunca altera saldos ou grava compras.

## Testes

- Verificação da regra 90/10, do acumulado mensal de metas, da DRE orçada, do plano de DDE e do início do horizonte OTB em testes unitários.
- Conferência dos dados agregados no Supabase após os seeds.
- Executar `npx vitest run --maxWorkers=2`, `npx tsc --noEmit` e `npm run build` antes de publicar.
