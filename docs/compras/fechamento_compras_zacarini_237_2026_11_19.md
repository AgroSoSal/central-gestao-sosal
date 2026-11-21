# Conferência do módulo Compras — Zacarini 2.3.7 (19/11/2026)

## Contrato de origem

- Planilha: `Gestão Zacarini - Painel 2.3.7.xlsx`, utilizada exclusivamente para extrair premissas e comparar fórmulas; nenhuma rota do ERP consulta Excel em tempo de execução.
- As fontes operacionais e metas versionadas vêm de Supabase; páginas de Compras consultam RPCs protegidas por Master ativo.
- **Nenhum valor simulado libera automaticamente pedidos**, pois a aprovação de OTB depende da conciliação de fontes reais, conferência gerencial e cálculo do pior cenário.

## Diferenças corrigidas e equivalências implementadas

| Referência na planilha | Regra conferida | Implementação | Situação |
|---|---|---|---|
| `OTB!R24` e `Verba Comprador!E20` | Comprador = verba × **90%**, reserva diretoria **10%**. O texto `Verba Comprador!A2` permanece desatualizado e diz 85%. A fórmula usa R24=90%. | `calculateOtb`, painel e testes de regressão ajustados a 90/10. | Corrigida, verba oficial ainda travada. |
| `OTB!P30/Q30`, `OTB!T173` e `Verba Comprador!E145/C9` | A MP especial da linha 173 é reservada primeiro no caixa **e participa uma única vez** do rateio global 90/10 de `OTB!P30/Q30`. `Verba Comprador!C9` é um indicador diferente: orçamento final após cortes de caixa/DDE/linha. | `calculateOtb` já rateia `releasedTotal` (MP + mercadorias) em 90/10; acrescentados testes com MP positiva. Não há integração homologada para equiparar `buyerBudget` ao valor final de `C9`. | Governança global conferida; orçamento final e linhas ainda precisam de fontes/validação. |
| `Dashboard!D36:D39`, `Metas de Vendas!B4` | O valor de outubro não é a meta de novembro; `B4=2026-10-01` no arquivo auditado. | 132 metas 2026 de `Metas de Vendas!D26:O53` versionadas por linha/loja/mês. | Corrigida e conferida no banco: outubro R$ 10.150.589, novembro R$ 10.000.000. |
| `Metas de Vendas!D14`, `D17:D20`, `D7:D13` | Percentual acumulado considera metas do início do ano até o mês selecionado; não é somente a meta daquele mês. | `accumulatedSalesTarget`; velocímetro anual e % anuais por linha/loja. | Reproduzida quando todas as competências estão cadastradas. |
| `Metas de Vendas!A46:O49` | Cassilândia tem **meta futura de dezembro de R$ 650 mil**, mas não consta nas seis filiais operacionais Supabase. | Configuração `meta_loja_CASS` separada, sem inventar venda realizada nem filial. | Registrada como planejamento, não operação. |
| `DRE 2026!D8:D33` e `Orçamento 2027!D7:D25` | Grupos `Orc_Dados`, Tipo=`Projetado`; receita líquida=bruta+impostos; lucro bruto=líquida+CMV; EBITDA=bruto+despesas; lucro líquido=EBITDA+financeiras+outros tributos. | 216 linhas `dre_orcado` versionadas 2026–27; painel mostra orçamento do mês e acumulado; margens anuais ponderadas. | Orçado de referência disponível; realizado atual pendente de base contábil classificada. |
| `OTB!P188:U188` e `Plano de Estoque` | DDE individual por subgrupo, ponderado por CMV; não equivale ao DDE total da rede quando há grupos sem plano. | Painel lê `fn_compras_plano_estoque_237` do Supabase e mostra cobertura dos subgrupos válidos. | Parcial: 56 grupos parametrizados na fonte, sem assumir planos inexistentes. |
| `OTB!B7` | Horizonte de compra começa no mês seguinte ao início do fluxo. | Prévia de três meses na tela OTB usando motor 12M operacional, com corte de mês correto. | Simulação disponível; sem verba ou status “LIBERADO”. |
| `Atendimento Fornecedor!K22:K26` | Validar giro/PMP, primeira data liberada, parcelas acumuladas por vencimento, verba por linha e integridade dos itens. | Atendimento agora oferece **conferência financeira de teste, ativada manualmente**, com custo diário, data de liberação, teto de caixa e saldo de cada linha editáveis. Corrigida a ordem cronológica das parcelas no K24 e o vencimento mais próximo no K23, mesmo que os prazos sejam informados fora de ordem. Testes de interface cobrem cenário válido, erro de giro, limite de caixa, verba excedida e fonte incompleta. | Fórmulas exercitáveis **sem atualizar banco**; premissas fictícias nunca homologam verba, não liberam pedido, nem são persistidas. O teto uniforme de teste não reproduz o calendário oficial de 26 semanas. |
| `Atendimento Fornecedor` e `Verba Comprador` | Detectar necessidade de reposição por DDE e prioridade de cobertura real inferior a 30 dias, sem confundir o último custo com cotação negociada. | Pré-ranking por fornecedor para os até 40 SKUs retornados, com número de SKUs críticos, quantidade sugerida, valor referencial e indicador explícito de fonte pendente. O cálculo de sugestão deixa de presumir estoque ou vendas zero quando a origem está ausente. | Indicador operacional do lote disponível; comparação formal de propostas e verba aprovada continuam pendentes. |
| `Atendimento Fornecedor!AP:AU / AW:BB` | Ratear a quantidade inteira pelas seis filiais conforme necessidade e sem sobras. | O rateio da rede passou a exigir exatamente seis linhas com estoque, vendas e pedidos pendentes válidos, além de DDE conhecido e venda total positiva; dados nulos ou filiais duplicadas deixam o resultado indisponível. | Corrigida a falsa distribuição quando a RPC devolve números ausentes; sem emissão de transferências no SISCOM. |
| Comparação auxiliar de negociação | Conferir duas propostas com os mesmos produtos/quantidades, sem escolher automaticamente um fornecedor. | Comparativo local usa quantidade × custo × (1 − desconto), arredondado por SKU, e evidencia a diferença entre propostas; preços incompletos bloqueiam o resultado. | **Função auxiliar, não fórmula da planilha**; não compara frete, tributos, prazo/caixa, nem grava cotações concorrentes no Supabase. |

## Continuação em 21/11/2026 — Integração SISCOM adiada pelo responsável

O responsável decidiu que a automação SISCOM ficará para depois e que a interface deve aceitar os valores ainda não integrados manualmente, **sem exigir que os números atuais do banco estejam atualizados**. A planilha original 2.3.7 foi relida por XML, e os extratores de referência existentes foram executados contra o arquivo recebido: **1.833 comparações da OTB, 0 divergências acima de R$ 0,01; seis fatores/tetos de caixa da Projeção 12M, zero divergências**.

| Células efetivas do XLSX | Fórmula verificada | Paridade no ERP |
| --- | --- | --- |
| `Atendimento!K22` | `K16>=K21`, usando prazo médio de pagamento e giro estimado (`K21`) | `validarAtendimento`, com custo diário previsto informado manualmente em `custo_diario_previsto`; ausência da fonte continua pendente. |
| `Atendimento!K23` | Primeiro vencimento (`K18`) deve ocorrer a partir da data liberada (`K19` ← `OTB!B17`) | Entrada `primeira_data_liberada` por competência e filial; comparação por data da primeira parcela. |
| `Atendimento!K24` | `COUNTIF(AM7:AM16,"✖*")=0`; cada parcela testa o vencimento contra a disponibilidade acumulada da OTB | Agora aceita tabela de `limite_caixa_acumulado` **por data de referência**, em ordem cronológica; o cenário uniforme fictício permanece opcional. |
| `Atendimento!K25` | Verba da linha `S7:S10` vem de `OTB!I17:I20`; orçamento do pedido por linha `V7:V10` | Entrada `saldo_verba_linha` separada para linhas 1–4, sem presumir que ausência significa saldo zero. Pode ser negativa: a planilha contém linha com orçamento negativo. |
| `Atendimento!K26:K27` | Rejeição de quantidade sem produto; `K27` resume os erros `✖` | Validações exibidas; cenário manual é **somente conferência**, jamais autorização de gravar no SISCOM. |
| `Atendimento!W63:X63` | `W=quantidade×custo×(1−desconto)`; `X=1−custo líquido/preço de venda` | `negotiatedPurchase` e testes existentes reproduzem os dois resultados. |
| `Verba Comprador!C8:E8` | Proteção do valor crítico de DDE por `MAX(0,MIN(1,(teto−protegido)/(necessidade−protegido)))` | `buyerCashCutFactor` com guardas para denominador e dados incompletos. |
| `Verba Comprador!E12` | `MAX(C12,MIN(B12,MAX(0,D12)))` | `buyerLineBudget`. |
| `OTB!R24`, `Verba Comprador!E20` | O multiplicador do comprador é **90%**; 10% reserva diretoria | `calculateOtb` e testes: corrigido conforme fórmula, não conforme o texto desatualizado da planilha. |
| `Projeção 12M!B645/B648/B652` | Liberação depende do primeiro mês com caixa viável e do teto projetado após os limites de pior cenário | Motor e simulação existem, mas **não podem ser homologados só com valores manuais isolados** sem todas as fontes de 12 meses. |

**Entrega de interface:** nova rota Master `/compras/entradas-manuais` com entrada, alteração, exclusão confirmada, importação/exportação de backup JSON, dimensões por SKU, linha, filial, competência e data. Foram disponibilizados campos de estoque, vendas, pedidos pendentes, custo, produção, recebimentos, pagamentos, saldo inicial e insumos financeiros K22–K25. O Atendimento usa o calendário e orçamento digitados ao escolher *Carregar entradas manuais*. Entradas são marcadas pendentes de integração, jamais efetivadas; não alimentam automaticamente estoque, saldos oficiais, NFs ou pedidos.

**Persistência autorizada na continuidade de 21/11:** criada a tabela aditiva `public.compras_siscom_insumos_pendentes` no projeto `eclcqhmclfspskawdcaw` pela migração `compras_siscom_insumos_pendentes_20261121`. O esquema está em `tabela_insumos_manuais_siscom_proposta.sql`. RLS habilitada, quatro políticas exigindo `public.profiles.role='master'` e `ativo=true` com `auth.uid()`, nenhuma permissão de leitura para `anon`; 0 avisos de segurança novos para a tabela no advisor. A interface agora lê/grava **exclusivamente no Supabase** com server actions autenticadas e verifica Master tanto na página quanto em cada ação; as entradas se tornam compartilhadas entre Masters. O modo de rascunho local do componente permanece como ferramenta de regressão, mas **não é utilizado na rota operacional**. Nenhuma carga SISCOM/RPA foi alterada.

**Não declarar como concluído o módulo financeiro oficial:** ainda faltam a Projeção 12M homologada, conciliação de fontes, fluxo de aprovação e integração SISCOM para a emissão. As telas simulam as fórmulas sem fingir liberação financeira nem misturar uma entrada local com o caixa oficial.

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
