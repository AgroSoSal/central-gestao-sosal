# Regras aprovadas — Conciliação dos Pedidos de Compra

Fonte funcional: aba **Pedidos de Compra** da planilha `Gestão Zacarini - Painel 2.2.24(3).xlsx`, fórmulas das colunas K a O (especialmente L12:O12).

Aprovação do escopo pelo responsável do projeto em 16/11/2026: a planilha especifica **regras e fórmulas**, mas seus registros, valores e datas de exemplo **não** são dados para importar. A origem operacional permanece no Supabase/SISCOM.

1. **COMP-001 — Valor nominal.** Quantidade pedida × custo unitário, sem importar valores preenchidos no Excel.
2. **COMP-002 — Conciliação.** Contabilizar apenas entradas (`tipo = ent`) do mesmo produto, filial e fornecedor, com data igual ou posterior à data do pedido. A identificação do fornecedor usa os 12 primeiros caracteres do nome na planilha.
   Entradas negativas permanecem no somatório por serem ajustes reais da base `painel.compras` (confirmado em 16/11/2026).
3. **COMP-003 — Repetições sem duplicidade.** Quando o mesmo produto/fornecedor/filial aparece em vários pedidos, distribuir o saldo de entradas por ordem cronológica, respeitando a data de cada pedido, sem usar a mesma quantidade mais de uma vez. Na mesma data, manter a ordem original das linhas.
4. **COMP-004 — Limites de quantidade.** Quantidade recebida fica entre zero e a quantidade pedida. Quantidade pendente = pedida − recebida.
5. **COMP-005 — Valor pendente.** Quantidade pendente × custo unitário do pedido.
6. **COMP-006 — Situação.** Zero recebido: `Em aberto`; recebido parcial: `Chegada parcial`; pedido totalmente recebido: `Já chegou – conferir/baixar`.
7. **COMP-007 — Produtos genéricos.** Códigos designados como genéricos não participam da conferência automática. Os códigos serão fornecidos por uma configuração explícita, sem copiar a lista de exemplos do Excel.
8. **COMP-008 — Correspondência de filiais.** Na interface existente, `SO SAL` identifica **Bandeirantes** (correção informada pelo usuário); `CAMPO GRANDE` identifica Campo Grande. Exibir o nome correto sem alterar os valores de filtro usados na função já publicada.

## Limites da implementação

- As fórmulas foram implementadas em uma função de domínio pura e em uma função PostgreSQL de leitura para os dados reais, com testes sintéticos claramente identificados.
- A única alteração no Supabase autorizada foi criar a nova função de leitura; nenhuma tabela, dado, rotina RPA ou função anterior foi modificada.
- A consulta anterior `public.fn_listar_pedidos_compra` devolvia somente os pedidos. A integração autorizada em 16/11/2026 será feita em uma função separada de leitura, protegida por perfil Master ativo, mantendo a função anterior intacta.
- A função de consulta é auditável em `docs/compras/fn_listar_pedidos_compra_conciliados.sql`; a execução requer `authenticated` **e** perfil Master ativo; `anon` e `PUBLIC` não têm EXECUTE.
- A lista de códigos genéricos é configurável em `SOSAL_COMPRAS_CODIGOS_GENERICOS` (lista de códigos separada por vírgula), sem copiar os códigos de exemplo da planilha.
- Em nenhuma situação deve ser exibida quantidade recebida igual a zero por falta de dados: ausência da fonte significa `Não conciliado`, não `Em aberto`.

## Etapa 2 — Decisões por item (colunas AP e AQ)

9. **COMP-009 — Decisão padrão financeira.** Na coluna AP, valor vazio significa `Aprovado` **exclusivamente nas fórmulas de projeção da planilha**. Isso não significa que um comprador tenha registrado uma aprovação operacional. A decisão é independente da situação de recebimento (colunas K–O).
10. **COMP-010 — Segurar.** O item fica suspenso até alguém alterar a decisão para `Aprovado`. Deverá ficar fora das projeções futuras de OTB e caixa quando esses módulos forem construídos.
11. **COMP-011 — Cancelar.** Sinaliza que Compras deve solicitar/efetuar o cancelamento no SISCOM. Não executa cancelamento automático; deverá ficar fora das projeções futuras.
12. **COMP-012 — Observações.** A coluna AQ é texto livre para justificar/contextualizar qualquer decisão. Não exige motivo obrigatório, pois a planilha também não exige.
13. **COMP-013 — Persistência.** Chave operacional do item: `(loja, pedido, produto_codigo)`, única nos 22.013 registros reais verificados antes da implementação. A atualização do RPA não apaga as decisões.
14. **COMP-014 — Auditoria.** Cada criação ou alteração de decisão/observação registra estado anterior e novo, momento e usuário Master; gravação repetida sem alteração não cria evento.
15. **COMP-015 — Segurança e disponibilidade.** Só perfil Master ativo registra ou consulta decisões. Falha ao buscar a tabela não pode ser tratada como decisão padrão Aprovado; a tela bloqueia a edição e exibe o motivo operacional.

Implementação da Etapa 2: tabelas independentes `public.compras_pedido_decisoes` e `public.compras_pedido_decisoes_auditoria`, com RLS, sem privilégios diretos `anon/authenticated`. RPCs de leitura e gravação verificam `auth.uid()` e `public.profiles` a cada chamada. SQL versionado em `docs/compras/decisoes_pedidos_compra.sql`.

## Etapa 3 — Gestão operacional e Follow-up (aprovada em 16/11/2026)

16. **COMP-016 — Aprovação explícita.** Na interface de gestão, decisão ausente = `Aguardando aprovação`, jamais `Aprovado`. A primeira gravação de `Aprovado` deve permanecer habilitada mesmo sem outra alteração. As projeções financeiras futuras continuam obedecendo COMP-009.
17. **COMP-017 — Fila e filtros.** Gerenciar pedidos exibe itens com quantidade pendente positiva, incluindo recebimento parcial. São abas distintas para `Aguardando aprovação`, `Aprovados` e `Segurar/Cancelar`, com painel de decisão aberto após selecionar uma linha. Pedido sem saldo conciliado não entra na fila.
18. **COMP-018 — Critério de Follow-up.** Apenas pedido explicitamente aprovado, com quantidade pendente estritamente positiva, é elegível ao acompanhamento de entrega. `Segurar`, `Cancelar` e itens integralmente recebidos ficam fora da fila ativa.
19. **COMP-019 — Pendência de entrega.** Evidenciar quantidade e valor pendentes após conciliação. Exemplo didático: pedida 100, recebida 60, pendente 40. A parcialidade não encerra o Follow-up.
20. **COMP-020 — Previsão/rastreabilidade.** Registrar previsão de entrega, próxima cobrança, resposta do fornecedor, posicionamento do comprador, transportadora, código de rastreamento e situação logística. Previsão vencida aparece em destaque; a resposta é registrada internamente pelo comprador, sem acesso direto do fornecedor.
21. **COMP-021 — Histórico.** Alterações de acompanhamento ficam auditadas por item, responsável e horário, sem sobrescrever eventos anteriores nem alterar pedidos ou NFs do SISCOM. Ao zerar o saldo, o item deixa a lista ativa, mantendo os registros no banco.

**Status:** regras de interface implementadas no código; SQL de persistência versionado em `docs/compras/followup_pedidos_compra.sql` e aplicado em 16/11/2026 após autorização explícita, pela migração `compras_followup_entregas_20261116`. Funções protegem leitura e gravação por Master ativo, com auditoria própria, sem alterações nas tabelas SISCOM/RPA. A interface bloqueia salvamentos quando a RPC não estiver disponível.

## Etapa 4 — Projeção financeira local de 26 semanas (aprovada em 16/11/2026)

**Escopo aprovado:** opção de leitura, **sem alteração no Supabase**, como preparação para a integração futura com Caixa e OTB. Fontes: aba `Pedidos de Compra`, colunas P–AL e AP, parâmetros B6/B7 e linha 2; saldos já conciliados do SISCOM; previsão informada no Follow-up quando existir.

22. **COMP-022 — Valor projetável.** Usar somente o valor pendente conciliado (`M*J`), sem incluir quantidade já recebida. Zero financeiro não gera novas parcelas; valor zero com entrega ainda pendente significa **sem valor financeiro**, e não entrega concluída. Valores ausentes/inconsistentes permanecem indisponíveis.
23. **COMP-023 — Decisão financeira.** `Aprovado` e decisão vazia entram na projeção financeira (padrão AP da planilha), mas decisão vazia **continua** `Aguardando aprovação` na operação. `Segurar` e `Cancelar` deixam de gerar parcelas futuras; os registros originais permanecem.
24. **COMP-024 — Chegada estimada.** Na ausência de previsão registrada pelo comprador no Follow-up, chegada = maior(data do pedido, data-base) + **7 dias**, conforme P12/B6. Previsão de Follow-up válida tem precedência. A data-base usa a data corrente em Campo Grande/MS.
25. **COMP-025 — Condições e parcelas.** Interpretar sequência explícita de até 10 dias (`30/60/90` etc.); cada vencimento = chegada + dias da parcela. Na condição **vazia**, assumir 30 dias e avisar. Na condição desconhecida, não inventar vencimentos, marcar para conferência e manter valor não programado. Parcelas repartem o saldo pendente com arredondamento ao centavo e soma exata.
26. **COMP-026 — Horizonte e atrasos.** Mostrar 26 intervalos consecutivos de 7 dias a partir da data-base. Separar parcelas vencidas antes da data-base e posteriores ao final do horizonte, sem ocultar os respectivos valores.
27. **COMP-027 — Fonte e segurança.** Reaproveitar somente as três RPCs existentes de conciliação, decisões e Follow-up, protegidas por Master. Falha na consulta de conciliação ou decisões interrompe o cálculo. Falha no Follow-up impede usar previsão informada e é sinalizada; o cálculo de 7 dias é identificado como estimativa.
28. **COMP-028 — Totais limitados ao lote (etapa original, substituída pela etapa 5).** A primeira versão projetava apenas 50 itens por lote. Essa limitação foi superada na etapa 5, mantendo a paginação da tabela para inspeção.

**Implementação:** `src/domains/compras/domain/purchase-payment-forecast.ts`, tela `/compras/previsao` e testes de domínio e interface. Nenhuma alteração de schema, tabela, RPC ou dado externo foi realizada; não há ainda integração real com caixa, OTB, títulos a pagar, bancos ou emissão no SISCOM.

## Etapa 5 — Consolidação paginada de toda a carteira (aprovada em 16/11/2026)

29. **COMP-029 — Cobertura integral.** A previsão global lê os lotes consecutivos de até 100 itens permitidos pela RPC; os 50 itens da tabela continuam independentes do resumo. Só publica os valores quando todas as linhas forem processadas. Limite da RPC: 1.000 páginas; se ultrapassado, interromper.
30. **COMP-030 — Integridade.** Conferir total declarado em cada lote, comprimento da página, identidade física `(importacao_id, linha_excel)` e momento da última importação. Dados ausentes, alterações detectadas, decisões ou Follow-up inacessíveis impedem divulgar total global parcial.
31. **COMP-031 — Continuidade da aprovação e do recebimento.** Um pedido não aprovado operacionalmente pode compor a simulação financeira pelo padrão AP vazio; os pedidos segurados/cancelados não compõem parcelas. Recebimento parcial aparece em evidência e só o saldo pendente é projetado.
32. **COMP-032 — Atualização logística.** Vencimento usa o Follow-up mais recente consultado; botão de recálculo permite atualizar a estimativa. Para não saturar a base, a leitura de conciliação opera com um lote SQL por vez; o resumo do próprio usuário pode ser reaproveitado em memória por até três minutos durante troca de página.
33. **COMP-033 — Não equivalência ao fluxo de caixa.** A planilha Zacarini exclui despesas de subgrupos `5.` ao levar a compra ao caixa. Como a RPC atual não expõe esse grupo, os valores do ERP são **simulação bruta**: nenhuma classificação ausente é presumida nem lançado valor em OTB/caixa. Também não existe decisão `Já pago` nas três decisões operacionais permitidas.

**Implementação:** `src/domains/compras/domain/purchase-forecast-consolidation.ts`, `src/components/compras/global-payment-forecast.tsx`, leitura apenas com a chave pública e sessão Master do usuário. Condições explicitadas em `docs/superpowers/specs/2026-11-16-compras-consolidacao-integral-design.md`.

## Etapa 6 — Auditoria de condições e equivalência com a Zacarini (16/11/2026)

34. **COMP-034 — Cartão e dias explícitos.** Conforme premissa B7 da aba Pedidos de Compra, condições **inequívocas** de cartão/crédito e condições vazias recebem prazo padrão de 30 dias, acompanhado de aviso ao comprador. Prazos explícitos aceitam `30d/60d` e `30 dias / 60 dias`, além dos separadores numéricos já documentados. Textos ambíguos com quantidade de parcelas, como `CARTÃO 6X`, e menções explícitas a **débito** não são transformados em vencimentos sem confirmação.
35. **COMP-035 — Conferência de exceções.** A consolidação integral conta as condições inválidas, separa seus valores do caixa projetado e apresenta até 30 exemplos auditáveis com fornecedor, filial, pedido, SKU, condição e saldo pendente. A lista respeita a ordem original da carteira paginada, independentemente da ordem de conclusão das consultas. Um aviso deixa explícita a quantidade total de exceções e que os demais podem ser localizados por filtro. A UI não altera a condição original no SISCOM.

**Limite mantido:** grupo/subgrupo `5.` não consta da RPC autenticada atual. A consulta não é base segura para o fluxo de caixa deduplicado enquanto não houver uma classificação autorizada por item (COMP-033). Nenhum dado ou objeto do Supabase foi alterado nesta etapa.

## Etapa 7 — Classificação complementar financeira (autorizada em 16/11/2026)

36. **COMP-036 — Fonte de classificação.** A classificação do item usa primeiro o complemento manual Master identificado por `(loja, pedido, produto_codigo)`, e depois `painel.produtos.grupo_subgrupo` pelo código do produto. A classificação manual corresponde à coluna AN da Zacarini: pode variar entre pedidos do mesmo SKU. Um produto sem cadastro não recebe classificação deduzida por descrição.
37. **COMP-037 — Segregação financeira.** Itens classificados em grupo/subgrupo que começam com `5.` ficam fora da projeção elegível para linha de compras do fluxo; seus saldos permanecem visíveis à parte para conferência de despesas. Itens sem classificação ficam pendentes e fora do valor elegível, nunca presumidos como compras. A simulação bruta continua visível para reconciliação.
38. **COMP-038 — Auditoria/segurança.** Somente Master ativo consulta e classifica itens por RPC autenticada; a classificação complementar é armazenada separadamente do SISCOM/RPA, com histórico imutável de alterações e motivo. Salvar a mesma classificação sem mudança não gera novo histórico.
39. **COMP-039 — Capacidade RPC.** Decisões e Follow-up limitam as listas a 50 chaves por chamada: o cliente deve fracionar lotes de conciliação de 100 itens em chamadas de até 50, interrompendo a consolidação integral se alguma falhar.

**Limite:** valores são apenas previsão, não títulos a pagar nem lançamentos financeiros. Categorias sugeridas vêm dos rótulos da planilha, sem carregar seus registros históricos de exemplo no banco.

**Status:** migração aditiva `compras_classificacao_financeira_20261116` aplicada no Supabase em 16/11/2026. Tabelas complementares criadas vazias, sem importar classificações da planilha; RPCs restritas a Master ativo e acesso direto revogado. UI apresenta itens não classificados e grava confirmação com motivo. Os avisos pré-existentes da auditoria de segurança sobre outras views/tabelas não foram alterados.

**Incidente corrigido em 16/11/2026:** o consolidado produziu erro no lote 2. Os logs do Supabase confirmaram três timeouts `57014` exatamente quando as três páginas SQL seguintes foram consultadas em paralelo. A RPC de conciliação é custosa (histórico de pedidos e NFs); por isso o processamento foi serializado, sem reduzir a cobertura de itens nem desativar os controles de integridade. O usuário continua vendo o progresso até o total final, que pode levar alguns minutos em carteiras grandes.

## Etapa 8 — Motor e painel OTB (implementação local 17/11/2026)

40. **COMP-040 — Horizonte e caixa.** A OTB calcula três meses consecutivos; o teto mensal corresponde a `OTB!B21:D21` da Projeção 12M, linha 652 (pior caso), e não à disponibilidade semanal de 26 semanas. Sem os três tetos auditados, não existe OTB operacional.
41. **COMP-041 — Necessidade e estoque.** Somente tipo `S` de mercadoria gera necessidade comercial `máx(0, CMV do mês + estoque-alvo de DDE − estoque projetado)`. Mês seguinte usa `máx(0, estoque anterior + verba liberada − CMV anterior)`. Pedidos anteriores ainda a receber entram no estoque inicial.
42. **COMP-042 — Prioridade e curva A.** A necessidade de matéria-prima agregada da linha 173 reserva caixa antes das mercadorias (`mín(necessidade MP, teto)`). O valor residual financia primeiro a participação de curva A de cada subgrupo e depois, proporcionalmente, demais curvas. Tipos `P` (produção própria), `M` (matéria-prima direta) e `N` (fora do OTB) não geram liberação comercial duplicada. A linha especial 173, apesar da classificação `S` na fotografia, é retirada dos subgrupos comerciais e representada somente em MP agregada.
43. **COMP-043 — Autoridade de orçamento.** Exatamente 85% da verba liberada destinam-se ao comprador e 15% à reserva da diretoria (`OTB!R24`). O fracionamento não soma nova verba ao teto. Percentual diferente é rejeitado como dado de entrada incompatível.
44. **COMP-044 — Saldos.** O saldo bruto do subgrupo segue `W/AF/AO = verba liberada + venda casada autorizada − pedidos gravados`. O saldo gerencial da linha deduz também `AV/AW/AX` (excesso), preservando negativos que indiquem estouro. Pedidos excluem situações Segurar/Cancelar, conforme fonte da planilha. O saldo total de mercadorias não é informado como saldo reconciliado de MP.
45. **COMP-045 — Fonte, segurança e homologação.** Nenhum zero substitui campo financeiro ausente ou não numérico. Cenário JSON local pode ser importado **somente para homologação**, jamais como saldo oficial. A página `/compras/otb` verifica identidade do Supabase Auth e a autorização Master ativo pela RPC já existente `fn_listar_decisoes_compra` com array vazio, sem buscar pedidos nem gravar dados. Falha de autorização bloqueia a tela. Sem integração verificada à Projeção 12M, estoque, DDE e pedidos completos, os indicadores operacionais permanecem indisponíveis.

**Conferência de planilha:** `node --experimental-strip-types scripts/compare-otb-workbook.mjs CAMINHO_XLSX` compara a saída com a própria aba OTB em 1.833 pontos (122 linhas × 5 campos × 3 meses + três totais). Tolerância de R$ 0,01. O arquivo XLSX não é copiado para o repositório nem seus valores comerciais aparecem em logs; a comparação é read-only. A implementação fica em `src/domains/compras/domain/otb-calculation.ts` e `src/components/compras/otb-dashboard.tsx`.

**Pendência para operação real:** definir e aprovar contrato de dados somente leitura que traga `Projeção 12M`, necessidades de MP, metas de DDE, histórico por subgrupo e pedidos completos do Supabase, com mesma data-base da Zacarini. Não foi criada/aplicada migration, não se executou atualização no Supabase e não foi realizado commit ou deploy nesta etapa.

**Integração read-only iniciada em 17/11/2026:** a tela `/compras/otb` passou a consultar o resumo da carteira via `fn_listar_pedidos_compra` com `p_tamanho=1`, depois de conferir Master pela RPC já existente. A consulta simples evita o custo da conciliação de NFs para mostrar apenas total de itens e última importação; erros e respostas parciais continuam indisponíveis. Não há ainda teto de caixa ou OTB operacional vindo do Supabase, conforme `docs/compras/otb-contrato-dados.md`.

## Etapa 9 — Trava financeira 12M e fonte comercial automática (17/11/2026)

46. **COMP-046 — Caixa de pior caso.** A Projeção 12M usa o menor caixa livre entre cada mês futuro e o fim do horizonte, acrescido do colchão explícito `OTB!B11`, limitado inferiormente a zero (`Projeção 12M!C612:N612`). Cada um dos três meses recebe fator entre zero e um calculado sobre seus vencimentos acumulados, após subtrair os vencimentos já liberados dos meses anteriores. Tetos = necessidades totais dos meses × fator respectivo (`B652:D652`). A regra exige 12 meses financeiros e três perfis de vencimentos válidos. Ausência de dado impede cálculo.
47. **COMP-047 — Fonte histórica e classificação.** O histórico mensal vendido/saída/CMV/lucro de `painel.vendas` é agregado por `painel.produtos.linha` usando `produto_cod`, sem modificação das origens. Produto ausente ou linha diferente de 1–4 permanece explicitamente na linha zero como exceção de qualidade. Histórico só é considerado coberto para os últimos 12 meses fechados se cada competência tiver vendido e saída e nenhuma linha zero no período. **Cobertura histórica não significa homologação da verba.**
48. **COMP-048 — Segurança e janela.** `public.fn_otb_historico_mensal` exige JWT e perfil Master ativo, aceita no máximo 24 competências de início de mês, revoga EXECUTE de `PUBLIC` e `anon` e concede somente a `authenticated`. A tela apresenta contagens auditáveis, não dados futuros inventados. A ausência do fluxo projetado e das premissas mantém os indicadores financeiros inativos.

**Teste de referência:** `scripts/compare-otb-cash-workbook.mjs` confronta os três fatores e tetos do XLSX (6/6 valores com desvio abaixo de R$ 0,01); `scripts/verify-otb-cash.mjs` testa pior caixa, liberação por prioridade e bloqueio de dados incompletos.

**Implantado no banco:** função aditiva de leitura `public.fn_otb_historico_mensal(date,date)` criada por migração `otb_historico_mensal_master_20261117` no projeto `eclcqhmclfspskawdcaw`. Confirmado `anon_pode=false`, `autenticado_pode=true`, `security_definer=true`; execução sem JWT retorna SQLSTATE `42501`. Não houve alteração em tabelas, histórico, RPA ou jobs. O estado de publicação da tela deve ser conferido no histórico GitHub/Vercel.

## Etapa 10 — Complemento autorizado de classificação histórica (17/11/2026)

49. **COMP-049 — Serviço e fertilizante.** O código `0` (SERVICOS) fica **fora da OTB** (`linha=-1`) e continua rastreado no total de origem. O código `104356` (FERTILIZANTE SULFAMMO META 29 1000KG) pertence à **Linha 4**, seguindo a classificação existente do mesmo produto em embalagem de 50KG (`104297`). Ambos foram aprovados explicitamente pelo responsável em 17/11/2026. Qualquer outro produto sem linha continua como exceção (`linha=0`), sem classificação deduzida.
50. **COMP-050 — Integridade do cadastro.** Os dois complementos ficam na tabela protegida `public.otb_classificacao_complementar_produto`, sem UPDATE/INSERT em `painel.produtos`, `painel.vendas` ou SISCOM. A RPC histórica agrega os produtos com classificação complementar antes da linha de cadastro, preservando serviços fora da cobertura comercial. A autenticação continua exigindo Master ativo e a tabela não concede `SELECT` direto a `anon` ou `authenticated`.

**Migração aplicada:** `otb_classificacao_complementar_20261117`. Reconciliação read-only: 419.564 registros históricos permanecem; 1.354 aparecem como serviço fora OTB, 2 foram classificados como Linha 4 e nenhum permanece na linha zero. Os indicadores de caixa continuam bloqueados porque a Projeção 12M financeira ainda não existe no Supabase.

## Etapa 11 — Posição operacional real da OTB (17/11/2026)

51. **COMP-051 — Estoque, CMV e DDE observado.** A posição operacional agrupa o estoque a custo (`painel.estoque.valor`) por linha e grupo/subgrupo do cadastro, consolidando as seis filiais sem somar novamente o cadastro de produto por loja. O CMV dos **90 dias anteriores à data-base**, sem incluir o próprio dia, vem de `painel.vendas` na visão `saida`, utilizando `custo_medio` já contabilizado por registro conforme a fonte histórica oficial. `DDE observado = 90 × estoque a custo / CMV 90d` somente quando CMV for estritamente positivo e conhecido. Ausência de CMV não é transformada em projeção nem em DDE-alvo. Complementos autorizados prevalecem sobre a classificação original; serviços fora OTB e categorias pendentes continuam identificáveis. Qualquer erro ou retorno incompleto da RPC bloqueia o consolidado, não gera valor parcial.

**Governança:** `public.fn_otb_posicao_subgrupos(date)` é apenas leitura, com guarda Master ativo no PostgreSQL, revogação de `PUBLIC/anon` e parâmetro de data-base limitada. É uma posição factual e **não substitui o motor financeiro de 12 meses, o orçamento, a necessidade projetada de matéria-prima, metas de DDE ou a conciliação de pedidos**. A página OTB mantém as travas financeiras até existirem premissas auditadas no Supabase; nenhuma planilha é fonte de dados operacional.
