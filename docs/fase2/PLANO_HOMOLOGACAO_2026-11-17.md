# Fase 2 — Preparação técnica e aceite (17/11/2026)

> Estado: **somente código preparado em branch de revisão**. Não aplicar SQL, não alterar \`painel.atualizar_tudo()\`, não liberar KPIs, não iniciar cargas e não publicar em produção sem OK **por escrito do Alex**. O branch GitHub NÃO é um branch de banco.

## Implantação por estágios

| Parte | Preparado neste branch | O que falta para estar concluído |
|---|---|---|
| Cadastro de representantes | Tabela privada \`painel.representantes\` | Códigos/nome/loja/tipo e cadastro oficial |
| Margem comissão | Staging, tabela publicada, conferência e views | Extração oficial do Siscom, períodos de jan/25 até hoje, taxa/bonificação incorporadas NA ORIGEM, conferência 3 dias |
| Conjugadas | Conjugada 1 + conjugada 2 preservadas; só conj. 1 entra na soma da loja | Confirmar chave da dupla no layout e aprovar a loja de conjugadas entre representantes diferentes |
| RPA Etapa 0 | Inspeção e quarentena, normalização materializada, fontes tipadas | Política de completude e aprovação escrita antes da publicação |
| Clientes novos/ativos | NÃO preparado | Falta SQL original \`view_clientes_novos_ativos.sql\` e definição histórica por representante |
| ABC e DDE | NÃO alterar existente | Falta especificação vigente Zacarini **2.3.1** com fórmulas/limites/testes |
| Parado loja/rede | NÃO preparado | Regra dependente do ABC e da separação entre estoque físico/filial e venda/representante |
| Inadimplência e despesas por representante | NÃO alterar existente | Chave oficial do representante no título e critério de alocação do centro de custo |
| OTB, fornecedores, caixa e pedidos finais | Somente fontes de RPA preparadas | Fórmulas e critérios completos da Fase 2 2.3.1; conciliação de histórico D-15 |
| \`painel.vendas\` e \`painel.receber\` | NÃO alterados | Ajustar ETL e modelagem após confirmar fonte do \`representante_cod\` |

**Por que \`painel.vendas\` não recebeu uma coluna \`representante_cod\`?**
A função atual \`painel.atualizar_vendas_mes\` usa \`INSERT INTO painel.vendas SELECT\` sem lista de colunas. Um ALTER TABLE isolado mudaria a quantidade de colunas e quebraria a carga diária. Além disso, a agregação atual perde a nota e não admite inferir o representante pela filial ou pelo vendedor. A alteração deverá ser feita junto da fonte, nova granularidade e ETL, em migração separada.

**Por que não há valores de margem estimados?**
A fonte oficial de remuneração é o próprio Relatório de Comissão: dedução de bonificações, custo financeiro e demais filtros devem estar presentes no arquivo. \`painel.vendas.lucro_liquido + comissao_liquido\` é útil para análise, mas não equivale à margem oficial.

## Contrato para importar o Relatório de Comissão

- \`mes_comercial\` identifica o mês do dia 25. Ex.: o mês encerrado em 25/10 tem \`mes_comercial = '2026-10-01'\`; a janela de origem é 26/09–25/10.
- Guardar o arquivo original, SHA-256, filtros completos, totais oficiais, número de vendedores e de linhas do TOTAL GERAL.
- Para cada linha, preservar a seção: VENDA, CONJUGADA_1, CONJUGADA_2, DEVOLUCAO, BONIFICACAO. Não alterar sinais nem dobrar/retirar bonificação por fora do relatório.
- \`chave_conjugada\` é o identificador do pareamento das duas participações; ele deve ser determinado **a partir do arquivo real**, sem dedução a partir do vendedor. Caso as seções não tenham um identificador seguro, não publicar.
- \`publicar_comissao_lote\` compara os totais informados, período, representantes e integridade dos pares; a substituição de um mês é transacional.
- \`v_conferencia_comissao\` compara **total geral com conjugada duplicada**, enquanto \`v_margem_filial_mes\` e \`v_margem_loja_mes\` contam a margem/venda da conjugada uma única vez.
- Se a conjugada envolver diferentes representantes, cadastrar a atribuição aprovada no objeto específico. Nunca repartir automaticamente valor da venda/margem em 50/50: esse percentual só foi especificado para a comissão.
- \`v_margem_loja_mes\` não apresenta o mês se qualquer linha não puder ser atribuída a um representante oficial.

## Etapa 0 — controles para o robô existente

A origem continua sendo \`"Só Sal".rpa_importacoes\` + \`"Só Sal".rpa_linhas\`. A tabela normalizada \`painel.rpa_linhas_normalizadas\` será preenchida **após** validação + aprovação. As views \`v_rpa_*_fonte\` consultam SOMENTE a tabela normalizada, não JSON nem \`v_titulos_recebidos\`.

- \`avaliar_importacao_rpa(id)\`: testa contagem de linhas, duplicação exata e campos obrigatórios. Bloqueia falhas; quando passa, deixa **PENDENTE_APROVACAO** (nunca publica automaticamente).
- \`aprovar_importacao_rpa(id, aprovador)\`: etapa operacional a ser chamada **somente após OK escrito** e conferência de completude. O nome informado NÃO substitui comprovação escrita.
- \`publicar_importacao_rpa(id)\`: insere dados tipados e preserva histórico. Uma falha aborta a transação. Não aciona \`painel.atualizar_tudo()\`.
- As três views de fonte **não** são os KPIs finais nem devem ser somadas sem regras de conciliação. Pendente D-15, saldo parcial, recebimentos múltiplos, reversões e deduplicação histórica.
- A completude não pode ser verificada só pela contagem de linhas: definição de janela, tipo de relatório, comparação com última extração aprovada e políticas específicas ainda devem vir do documento oficial. Não estabelecer limites numéricos por suposição.

**Leituras realizadas no banco de produção, sem modificar dados:**

| Importação | Relatório | Linhas | Repetições adicionais |
|---|---|---:|---:|
| 21 (16/11) | fornecedores_a_pagar | 4.642 | **392** |
| 26 (16/11) | fornecedores_a_pagar | 4.245 | 0 |
| 31 (17/11) | clientes_a_pagar | 337 | **2** |
| 32 (17/11) | fornecedores_pagos | 1.014 | 0 |
| 33 (17/11) | pedidos_compra | 382 | 0 |
| 34 (17/11) | fornecedores_a_pagar | 4.216 | 0 |

As 2 repetições em clientes a pagar NÃO devem ser eliminadas sem verificar se são registros legítimos.

**Permissões de ETL:** foi confirmado por consulta somente-leitura que `service_role` não possui `USAGE` no schema `"Só Sal"` nem no schema `painel`. Por isso, as funções de ETL deste rascunho são `SECURITY INVOKER` e só podem ser chamadas por conexão administrativa de banco, sob controle operacional; **não conceder acesso ao schema legado à chave REST**. A implementação do agendamento deve usar a conexão administrativa autorizada, não a chave pública do frontend.

> **Segurança:** a 4ª migração usa `painel_interno` para armazenar projeções materializadas, mantendo as três views públicas como `security_invoker`. A auditoria do branch não acusou `security_definer_view` nem materialized view exposta na API. Não abrir o schema `painel_interno` nas configurações do REST API.

## Homologação

1. Provisionar um banco **isolado**, após aprovar eventual custo do branch Supabase, ou ambiente PostgreSQL com a mesma estrutura. Não executar no banco principal.
2. Rodar as migrações nesta ordem: \`...140000...\`, \`...141000...\`, \`...142000...\`.
3. Validar grants/RLS. \`anon\` só pode consultar views agregadas explicitamente concedidas; não pode consultar tabelas novas, nem executar funções de publicação.
4. Verificar Relatório de Comissão no mês de 26/09–25/10/2026 contra TODOS os totais definidos no e-mail do Alex (venda, margem, comissão, vendedores, conjugadas e filiais), sem ajuste/fator de correção.
5. Conferir também por **representante** e que nenhum mês fique visível com conjugada ou representante pendente.
6. Rodar a validação RPA contra os lotes 21 e 34, garantindo bloqueio de 392 repetições sem excluir nenhum dado da origem.
7. Medir performance e limites antes de agendar. Critérios para ABC/DDE e clientes requerem documento original e planilha atual.
8. Comparar resultado com planilha/relatório por **3 dias consecutivos**; registrar data, período, totais e divergências.
9. Encaminhar SQL, evidências e plano de reversão ao Alex. **Somente com aprovação escrita** migrar para produção e, depois, revisar integrações.
10. Não enviar extratos, dados de clientes, planilhas financeiras ou arquivos reais ao repositório GitHub, que possui visibilidade pública.

## Bloqueios conhecidos

- Especificação Fase 2 2.3.1 está em artifact privado (não foi possível abrir).
- SQL original de clientes não estava acessível.
- Não existe no Supabase atual fonte validada para representante, bonificações/conjugadas completas nem custo financeiro exato de comissão.
- Power Automate Desktop está no Windows local e não é controlável por esta integração.
- Um branch Supabase separado pode gerar **cobrança por hora** e exige consentimento explícito antes de criá-lo.


## Complemento de desenvolvimento (17/11, continuação)

As migrações adicionais **somente no GitHub** aumentam a cobertura técnica sem presumir regras comerciais:

- \`...144000_fase2_vendas_detalhe_e_eventos_cliente.sql\`: nova tabela tipada \`painel.vendas_detalhe_origem\` e função administrativa para recuperar NF, cliente, condição/forma de pagamento e comissão dos relatórios ABC já disponíveis. NENHUM valor é tratado como margem oficial do Relatório de Comissão. A função não modifica a carga \`painel.vendas\`; é um ETL por período/filial, sem execução automática. A view \`painel.v_clientes_eventos_representante\` oferece apenas eventos de venda homologados, **não** os KPIs "novos/ativos", pois falta o SQL assinado.
- \`...145000_fase2_abc_estoque_insumos_sem_regras_novas.sql\`: fontes de estoque físico por filial e rede, com demanda 90d e comparativo anual tal como já calculados por \`painel.v_abc_janelas\`. Não calcular Curva A/B/C, DDE ou "parado" sem a fórmula oficial da planilha 2.3.1. Não usar filial como representante.
- \`...146000_fase2_bloqueio_margem_nao_homologada.sql\`: bloqueia a exposição dos KPIs de margem se a conferência da **última carga** do mês não estiver OK, para evitar apresentação de números antigos como aprovados.

A fonte real \`"Só Sal".v_margens\` foi consultada por SELECT em CG out/2026 e possui NF, período, código de cliente/vendedor e condição/forma de pagamento. O teste é somente de leitura; **as três migrações adicionais ainda não foram instaladas nem testadas em um PostgreSQL isolado**.

O branch de banco anteriormente criado foi encerrado após testes iniciais, evitando custo contínuo. O branch GitHub/PR #4 continua em revisão. Não criar nova homologação paga nem promover produção sem seguir as autorizações exigidas.

## Auditoria adicional — insumos de estoque (somente SELECT na produção)

- Estoque físico no painel: **10.111** combinações de estoque.
- Combinações com dados correspondentes em \`painel.v_abc_janelas\` (filial antiga): **5.946**.
- Combinações sem correspondência de histórico ABC: **4.165**.
- Combinações (filial, produto) duplicadas após o JOIN: **0**.

A ausência na ABC NÃO equivale automaticamente à ausência de venda. É um caso de *cobertura não disponível* que não autoriza calcular DDE infinito ou classificar "parado" sem a regra e o período exatos da versão 2.3.1. As consultas não efetuaram DDL nem alterações nos dados.
