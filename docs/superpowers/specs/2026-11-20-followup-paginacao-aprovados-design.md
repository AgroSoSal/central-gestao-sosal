# Follow-up de Compras — paginação dos itens aprovados

## Objetivo

Exibir todos os pedidos de compra com aprovação operacional explícita (`Aprovado` ou `Já pago`) e saldo conciliado de entrega positivo, sem páginas aparentemente vazias causadas por filtrar apenas 50 itens de uma página geral.

## Escopo e garantias

- A fonte continua sendo exclusivamente o Supabase SISCOM/RPA, sem valores fictícios.
- A regra de recebimento é idêntica à da função `public.fn_listar_pedidos_compra_conciliados`, que permanece inalterada.
- Uma nova RPC Master, somente leitura, filtra aprovação e saldo antes da paginação. Devolve a contagem global de itens elegíveis para os filtros atuais e até 50 registros por página.
- A RPC mantém filtros de busca, filial, período e códigos genéricos; não altera decisões, acompanhamentos, histórico, funções originais, dados ou jobs.
- A interface consulta a RPC nova e depois busca os históricos apenas para as chaves devolvidas, sem consultar decisões novamente para esse lote.
- Ausência de aprovação, falta de conciliação ou erro de RPC nunca cria pedidos ou aprovações.
- Proteger a RPC por JWT Master ativo, retirar EXECUTE de `PUBLIC`/`anon`, limitar paginação e tempo de consulta. Nunca usar `REFRESH MATERIALIZED VIEW` ou fazer agregação persistente.

## Alternativas consideradas

1. **Nova RPC paginada após conciliação (escolhida):** mantém saldo fiel e entrega lotes completos, com um limite de tempo para proteger o banco.
2. Percorrer páginas antigas até achar aprovados: multiplicaria consultas e poderia pressionar o Supabase; rejeitada.
3. Criar cache materializado com refresh: poderia atrasar o RPA e ficar desatualizado; rejeitada.

## Aceite

- Quando a página geral contém itens não aprovados, a primeira página do Follow-up continua mostrando até 50 **aprovados com saldo** sem lacunas.
- Todos os filtros e a navegação usam a contagem de elegíveis, não o total bruto de pedidos.
- Se não há aprovações, resposta com total zero e sem varrer o histórico.
- Acesso não Master retorna `42501`; erro não gera resultados fictícios.
- Testes de UI, typecheck, lint e build passam; consulta SQL é explicada e testada sem escrita operacional.
