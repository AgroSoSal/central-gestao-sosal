# Compras: aprovação explícita, fila e follow-up

## Escopo aprovado

- A regra financeira herdada da planilha é `AP vazio = Aprovado`, apenas para projeções futuras; ela **não comprova aprovação operacional**.
- Sem registro na tabela de decisões, exibir `Aguardando aprovação`, com ação de aprovar, segurar ou cancelar. Apenas a gravação explícita significa `Aprovado` operacional.
- `Gerenciar pedidos`: tabela com seleção de linha e botão visível de gerenciamento em painel separado; filtros `Aguardando aprovação` / `Aprovados` / `Segurados ou cancelados`; apenas itens com quantidade pendente estritamente positiva na fila operacional principal, incluindo entregas parciais.
- `Follow-up`: itens **explicitamente aprovados** com saldo de entrega positivo; quantidade e valor pendentes evidenciados; formulário de previsão, posicionamentos do fornecedor/comprador, próximo contato, transportadora, rastreio e situação da entrega. Retirar da fila ativa quando zerar o saldo, mas preservar o registro e auditoria.
- Não confundir situação de recebimento com aprovação. Exibir `SO SAL` como Bandeirantes.

## Limites

- Leitura de pedidos e conciliação via RPC existente, no máximo 50 itens por lote; indicadores deixam claro que não são totais globais.
- Após autorização expressa em 16/11/2026, apenas as **novas** tabelas e RPCs de acompanhamento foram criadas pela migração `compras_followup_entregas_20261116` no projeto `eclcqhmclfspskawdcaw`. Nenhuma tabela SISCOM/RPA existente foi alterada.
- Sem acionamento automático de fornecedores, alteração em pedidos do SISCOM ou integração financeira/OTB. Publicação no GitHub/Vercel igualmente autorizada expressamente em 16/11/2026.

## Dados e segurança

Identidade: `(loja, pedido, produto_codigo)`. Decisões e follow-up são isolados das importações SISCOM/RPA. Gravações futuras deverão exigir Master ativo via banco, registrar autor/data e histórico antes/depois. Falha em conciliação ou leitura de decisões interrompe a exibição operacional, sem presumir saldos ou aprovações.
