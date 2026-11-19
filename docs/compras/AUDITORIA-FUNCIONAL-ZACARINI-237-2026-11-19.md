# Auditoria funcional — Compras x Gestão Zacarini 2.3.7

**Data-base da conferência:** 19/11/2026. **Referência:** arquivo original `Gestão Zacarini - Painel 2.3.7.xlsx`, lido diretamente e sem importar seus dados. **Código revisado:** módulo `src/app/compras` e `src/domains/compras`. **Supabase:** projeto `eclcqhmclfspskawdcaw`. Após autorização explícita, criadas três RPCs novas somente de leitura, protegidas por Master ativo e paginação. Nenhuma tabela original, dado, job, saldo ou rotina RPA/SISCOM foi alterada.

## Cobertura por fluxo

| Referência no XLSX | No ERP web | Situação | Diferença que ainda impede a equivalência integral |
| --- | --- | --- | --- |
| Pedidos de Compra, colunas A:O | `/compras` | Operacional | Conciliação com entradas NFs via RPC Master, conforme contrato; disponibilidade depende da carga SISCOM. |
| Pedidos de Compra, AP:AQ | `/compras/gerenciar` | Operacional | Decisão e auditoria por item; operação não executa o cancelamento no SISCOM. |
| Pedidos de Compra, acompanhamento | `/compras/follow-up` | Operacional | Previsão, cobrança, logística e histórico; somente itens com aprovação explícita. |
| Pedidos de Compra, P:AL | `/compras/previsao` | Parcial | Simula 26 semanas com saldo pendente; ainda não equivale à integração contábil final, e condições ambíguas exigem conferência. |
| Atendimento Fornecedor | `/compras/atendimento` | Parcial | Busca, DDE, sugestão, negociação, mensagens e rascunhos; sem autorização final, emissão no SISCOM, ranking completo da marca e fluxo de pagamento oficial. |
| Cad_Despesas / Atendimento Fornecedor | `/compras/atendimento` | Parcial | Catálogo com 42 classificações e rascunho; sem limite de caixa aprovado e emissão de despesas. |
| Painel OTB / OTB | `/compras/otb` | Parcial | Estoque e CMV real agrupados por subgrupo e motor de 3 meses disponível; não existe cenário completo homologado de caixa, MP, previsões por subgrupo e pedidos gravados. A correção desta auditoria permite percorrer todos os subgrupos, não apenas os 50 primeiros. |
| Verba Comprador | Motor de domínio do Atendimento/OTB | Parcial | Fórmulas de 85%/15%, proteção de itens com DDE menor que 30 e corte testadas; não há verba líquida autorizada por linha. |
| Plano de Estoque | `/compras/plano-estoque` | Parcial | Visão mensal de seis competências e 56 metas, DDE/CMV observado. Faltam gerente, aprovação e conciliação das denominações diferentes, sem mapeamento por semelhança. |
| Projeção 12M / Premissas 12M | Motor financeiro isolado, `/compras/otb/premissas` | Bloqueado para decisão | `painel.alex_projecao_12m` e `public.otb_premissas_financeiras_12m` não têm cenário aprovado; a abertura bancária não é conciliada. São necessários projeções de recebimentos/pagamentos, custos, despesas, MP, curvas de prazo e cenários de pior caso. |
| Produção Própria | `/compras/producao-propria` | Parcial | Catálogo real de 168 SKUs `marca='SO SAL'`, simulador de `kg × R$/t / 1000` e frete. Falta cadastro homologado e persistente de peso, custos e aprovação. |
| Estoque Parado | `/compras/estoque-parado` | Parcial | Posição de rede por SKU, valor parado e sem giro/excesso paginados. Crescimento sazonal é aproximado porque `_Base` e `_Comparavel` da Power Query não existem na view atual. |
| Liquidação Lojas | `/compras/liquidacao-lojas` | Parcial | Ranking por SKU/filial, exclusões, DDE estimado e indicação de destino entre filiais; não executa transferência no SISCOM. |
| Liquidação Linhas | `/compras/liquidacao-linhas` | Parcial | Ranking por valor parado e filtros de linha, sem responsável nem acompanhamento formal de plano de ação. |

## Dependências reais antes de liberar compra financeira

1. **Extratos:** 10 contas SISCOM importadas; em 19/11 só 5 tinham registro até 18/11, e todos os saldos estão identificados como não conciliados. O usuário atualizará depois. Nenhum saldo misto de datas deve virar caixa inicial oficial.
2. **Premissas:** a simples atualização de extratos não cria Projeção 12M. A fonte homologada de pior caso tem 0 registros, e ainda faltam fluxos futuros versionados de receitas, custos, despesas, vencimentos e MP.
3. **Mestre de estoque:** agora há RPC Master paginada SKU × filial e rede. A visão ABC foi atualizada até 18/11/2026, e o estoque até 19/11/2026. O cálculo sazonal é **estimativo** até receber os marcadores da Power Query. A liquidação não equivale ao DDE observado ou verba OTB.
4. **Aprovação/emissão:** o Atendimento prepara rascunhos; nenhum comando deve converter simulação em aprovação, pedido SISCOM ou conta a pagar sem fluxo de alçada autenticado e auditável.

## Próximas implementações, em ordem de dependência

1. **Concluído em 19/11:** três consultas protegidas e paginadas, sem `REFRESH`, e cinco telas de estoque, plano, liquidação e produção, com navegação. Leitura real: 1.987 SKUs consolidados, 336 metas em seis competências e 168 produtos de marca própria. Consulta SQL de liquidação observada em cerca de 0,25 s no plano analítico (não é garantia de latência pela API).
2. Homologar `_Base`/`_Comparavel`, o limite DDE inicial de 60 dias, a lista de exclusões e os 10 nomes divergentes; cadastrar peso/custo aprovados e responsáveis pelas ações/transferências.
3. Concluir ranking de fornecedores e saldo por linha no Atendimento; integrar execução de pedidos e remanejamentos somente com alçadas auditáveis.
4. Atualizar e validar extratos bancários, registrar políticas financeiras e projetar 12 meses com pior caso. Só então ligar a saída oficial ao motor OTB de três meses e à Verba do Comprador.
5. Homologar autenticação, decisões, Follow-up, rascunhos, classificação e emissão SISCOM com usuário Master em ambiente real antes de declarar o módulo concluído.

**Política:** Ausência de dado, erro de RPC ou cenário incompleto nunca equivalem a valor zero ou compra liberada. Filial `SO SAL` continua mapeada para Bandeirantes conforme confirmação do usuário.
