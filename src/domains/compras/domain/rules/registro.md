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

9. **COMP-009 — Decisão padrão.** Na coluna AP, valor vazio significa `Aprovado`. A decisão é independente da situação de recebimento (colunas K–O).
10. **COMP-010 — Segurar.** O item fica suspenso até alguém alterar a decisão para `Aprovado`. Deverá ficar fora das projeções futuras de OTB e caixa quando esses módulos forem construídos.
11. **COMP-011 — Cancelar.** Sinaliza que Compras deve solicitar/efetuar o cancelamento no SISCOM. Não executa cancelamento automático; deverá ficar fora das projeções futuras.
12. **COMP-012 — Observações.** A coluna AQ é texto livre para justificar/contextualizar qualquer decisão. Não exige motivo obrigatório, pois a planilha também não exige.
13. **COMP-013 — Persistência.** Chave operacional do item: `(loja, pedido, produto_codigo)`, única nos 22.013 registros reais verificados antes da implementação. A atualização do RPA não apaga as decisões.
14. **COMP-014 — Auditoria.** Cada criação ou alteração de decisão/observação registra estado anterior e novo, momento e usuário Master; gravação repetida sem alteração não cria evento.
15. **COMP-015 — Segurança e disponibilidade.** Só perfil Master ativo registra ou consulta decisões. Falha ao buscar a tabela não pode ser tratada como decisão padrão Aprovado; a tela bloqueia a edição e exibe o motivo operacional.

Implementação da Etapa 2: tabelas independentes `public.compras_pedido_decisoes` e `public.compras_pedido_decisoes_auditoria`, com RLS, sem privilégios diretos `anon/authenticated`. RPCs de leitura e gravação verificam `auth.uid()` e `public.profiles` a cada chamada. SQL versionado em `docs/compras/decisoes_pedidos_compra.sql`.
