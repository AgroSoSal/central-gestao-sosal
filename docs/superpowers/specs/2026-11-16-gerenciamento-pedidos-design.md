# Gerenciamento de pedidos de compra — desenho aprovado

## Objetivo

Separar a consulta histórica de pedidos da tomada de decisão. A tela `/compras` continua focada em filtros, NFs e saldos, com um botão destacado **Gerenciar pedidos**. A nova tela `/compras/gerenciar` mostra somente itens com quantidade pendente de recebimento, recebimento parcial ou decisão atual `Segurar`/`Cancelar`.

## Abordagens consideradas

- **Edição dentro da tabela:** menor custo, mas o botão fica escondido pelo scroll horizontal. Rejeitada pelo usuário.
- **Nova tela dedicada (escolhida):** libera a consulta principal e oferece cartões com ações acessíveis, sem tabela larga.
- **Todos os pedidos na tela de gestão:** colocaria itens já integralmente recebidos na fila, desviando o foco. Rejeitada pelo usuário.

## Regras de negócio

1. Considerar em gestão itens com quantidade pendente maior que zero, situação `Em aberto`/`Chegada parcial` ou decisão `Segurar`/`Cancelar`.
2. Excluir itens totalmente recebidos com decisão `Aprovado` (inclusive decisão em branco, que equivale a Aprovado na planilha).
3. Decisão `Segurar`/`Cancelar` permanece visível mesmo quando o pedido foi integralmente recebido.
4. Não mostrar valores pendentes inventados se a conciliação de NFs estiver indisponível; a tela de gestão informa a falha.
5. Se as decisões não puderem ser consultadas, não construir uma fila incompleta presumindo `Aprovado`.
6. Preservar chave do item `(loja, pedido, produto_codigo)`, a RPC de leitura conciliada, a RPC de gravação, histórico, e a exigência de perfil Master ativo.
7. `SO SAL` identifica Bandeirantes na interface. Nenhum cancelamento é enviado automaticamente ao SISCOM. OTB/caixa permanecem fora desta mudança.

## Navegação e interface

- Na consulta, substituir os editores por um único CTA destacado **Gerenciar pedidos**, visível acima da listagem.
- A tela de gestão tem cabeçalho com retorno à consulta, cartões por item, situação de recebimento, valores, filial, fornecedor, decisão atual, motivo e botão de edição visível sem rolagem lateral.
- Manter filtros `busca`, `loja`, `inicio`, `fim` e navegação por lotes de registros. Os filtros usam os identificadores originais do banco.
- Preservar esses filtros ao ir da consulta para o gerenciamento e ao voltar, para não perder o contexto do pedido pesquisado.
- A RPC existente pagina antes da conciliação; para não alterar a regra de conciliação nem efetuar uma consulta onerosa sobre todo o histórico, a gestão processa lotes de até 50 itens conciliados e exibe somente os que atendem às regras. A contagem exibida é a do lote, **não** um total global de pendências. O botão de próximo lote permite chegar aos pedidos antigos; busca e filtros ajudam a encontrar casos específicos.
- Evitar nova tabela, migration ou deploy separado. A consulta mantém o seu fluxo original.

## Aceitação

- O botão `Gerenciar pedidos` aparece sem rolagem horizontal na consulta.
- A tabela principal não tem mais editor nem coluna de decisão.
- A navegação preserva os filtros e o editor não ultrapassa a largura do cartão em telas pequenas.
- A rota de gestão é protegida com o mesmo login e Master que a consulta.
- Somente os itens relevantes aparecem em cada lote, preservando `Segurar`/`Cancelar` mesmo recebidos; não há inclusão silenciosa de itens quando consultas falham.
- As decisões continuam sendo gravadas e auditadas pela mesma RPC, sem novas gravações na origem RPA.
