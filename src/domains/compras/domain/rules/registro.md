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
