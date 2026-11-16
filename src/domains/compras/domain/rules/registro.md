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
