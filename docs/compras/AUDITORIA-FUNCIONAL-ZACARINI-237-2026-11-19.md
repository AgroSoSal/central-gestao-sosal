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
| Projeção 12M / Premissas 12M | Motor financeiro isolado, `/compras/otb/premissas`, **`/compras/otb/fluxo-caixa`** | Preparatório disponível; bloqueado para decisão | Incluída conferência automática dos dez saldos bancários na data-base comum, cruzamento aritmético com os arquivos e agenda de 12 meses de recebíveis e fornecedores identificados. `painel.alex_projecao_12m` e `public.otb_premissas_financeiras_12m` ainda não têm cenário aprovado. Faltam CAP integral reconciliada, projeção de despesas, MP, vendas futuras e pior caso. |
| Produção Própria | `/compras/producao-propria` | Parcial | Catálogo real de 168 SKUs `marca='SO SAL'`, simulador de `kg × R$/t / 1000` e frete, **cadastro técnico persistente em rascunho com trilha de auditoria**. Falta a homologação formal de custos e aprovação para produzir. |
| Estoque Parado | `/compras/estoque-parado` | Operacional para análise | Posição de rede por SKU, valor parado e sem giro/excesso paginados. Em nova conferência, `_Base`/`_Comparavel` foram encontrados como **fórmulas locais do Excel**, que dependem da tabela de filiais `ABCEstoque_DDE!E5:G10`. A regra foi replicada na RPC; as bases SISCOM podem mudar após cada RPA. |
| Liquidação Lojas | `/compras/liquidacao-lojas` | Parcial | Ranking por SKU/filial, exclusões, DDE previsto com regra sazonal da planilha e indicação de destino entre filiais; não executa transferência no SISCOM. |
| Liquidação Linhas | `/compras/liquidacao-linhas` | Parcial | Ranking por valor parado e filtros de linha, sem responsável nem acompanhamento formal de plano de ação. |

## Dependências reais antes de liberar compra financeira

1. **Extratos:** 10 contas SISCOM importadas, 79.303 movimentos, 1.783 registros de saldo; 10/10 arquivos fecham aritmeticamente com os saldos finais. Em 19/11 só 5 contas tinham registro até 18/11; as demais chegam a 17/11, 16/11 ou 11/11. Nova RPC lê a posição de todas na data-base comum (11/11/2026), com transporte do último saldo observado por conta. Nenhum saldo misto de datas vira caixa inicial oficial; conciliação homologada segue 0/10.
2. **Premissas:** a simples atualização de extratos não cria Projeção 12M. A nova agenda de 12 meses mostra recebíveis de `painel.receber` e títulos do último arquivo de fornecedores, com vencimento. Esse arquivo pode ser D-15 e não é a carteira integral; os valores exibidos são *identificados*, não uma previsão completa. A fonte homologada de pior caso tem 0 registros, e ainda faltam fluxos futuros versionados de receitas, custos, despesas, vencimentos e MP.
3. **Mestre de estoque:** agora há RPC Master paginada SKU × filial e rede. A visão ABC foi atualizada até 18/11/2026, e o estoque até 19/11/2026. O Excel usa `_Comparavel=S` apenas em Bandeirantes, Campo Grande, Pedro Gomes e Rio Verde. Coxim não participa do crescimento, mas usa o ano passado; Anastácio usa só os últimos 90 dias. O fator é calculado por SKU (fallback subgrupo, depois 1), limitado entre 0 e 4. A nova RPC reproduz essa seleção. A liquidação não equivale ao DDE observado ou verba OTB.
4. **Aprovação/emissão:** o Atendimento prepara rascunhos; nenhum comando deve converter simulação em aprovação, pedido SISCOM ou conta a pagar sem fluxo de alçada autenticado e auditável.

## Próximas implementações, em ordem de dependência

1. **Concluído em 19/11:** três consultas protegidas e paginadas, sem `REFRESH`, e cinco telas de estoque, plano, liquidação e produção, com navegação. Leitura real: 1.987 SKUs consolidados, 336 metas em seis competências e 168 produtos de marca própria. Consulta SQL de liquidação observada em cerca de 0,25 s no plano analítico (não é garantia de latência pela API).
2. **Regra `_Base`/`_Comparavel` identificada e implementada em 19/11**: os valores vêm de fórmulas locais (não de colunas no Supabase), com seleção por filial, não por SKU. Limite DDE de 60 dias, lista de exclusões e 10 nomes divergentes permanecem sujeitos a revisão gerencial; o cadastro técnico de peso/custo agora aceita rascunhos auditáveis, mas sua aprovação formal ainda depende da alçada da empresa.
3. Concluir ranking de fornecedores e saldo por linha no Atendimento; integrar execução de pedidos e remanejamentos somente com alçadas auditáveis.
4. Atualizar e validar extratos bancários, registrar políticas financeiras e projetar 12 meses com pior caso. Só então ligar a saída oficial ao motor OTB de três meses e à Verba do Comprador.
5. Homologar autenticação, decisões, Follow-up, rascunhos, classificação e emissão SISCOM com usuário Master em ambiente real antes de declarar o módulo concluído.

**Política:** Ausência de dado, erro de RPC ou cenário incompleto nunca equivalem a valor zero ou compra liberada. Filial `SO SAL` continua mapeada para Bandeirantes conforme confirmação do usuário.
