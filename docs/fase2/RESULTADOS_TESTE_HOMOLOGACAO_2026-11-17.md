# Execução de homologação — 17/11/2026

Ambiente: Supabase branch `fase2-homologacao-20261117`, projeto de teste `qvcjxuryozroaratkutg` (**sem dados de produção**).

## Resultados confirmados no PostgreSQL da homologação

- 3 migrações SQL executadas com sucesso após criar schema mínimo de teste.
- Teste RPA com dados fictícios de fornecedores a pagar: 3 registros, 1 repetição adicional; `avaliar_importacao_rpa` → `BLOQUEADA`; nenhuma linha normalizada.
- Teste RPA fictício de pedido de compra: 2 registros sem duplicação; `PENDENTE_APROVACAO` → `APROVADA` (somente homologação fictícia) → `PUBLICADA`. Total matemático de teste = 42.
- Comissão fictícia out/26: cinco linhas, incluindo CONJUGADA_1/2, VENDA, DEVOLUCAO e BONIFICACAO. Total geral fictício = venda 650, margem 105, comissão 8,50. `painel.v_conferencia_comissao` marcou `OK` com diferenças zero.
- Consolidação fictícia sem conj. duplicada: CG = venda 600 / margem 100; CX = venda -50 / margem -15; por representantes 100 e 200, respectivamente.
- Um lote fictício de comissão seguinte com total informado 999 para uma soma real de 650 foi **rejeitado**. `v_conferencia_comissao` marcou `ERRO`; o lote anterior publicado (5 linhas, venda 650) **permaneceu intacto**.
- Permissões inspecionadas: `anon` tem SELECT nas views agregadas e não tem SELECT em `comissao_notas` ou `rpa_linhas_normalizadas`; tampouco EXECUTE em `publicar_comissao_lote`. No schema mínimo do teste, a permissão USAGE de `anon` não foi concedida; em produção, a permissão existente já é diferente e deve ser testada novamente após homologação integral.

## Limitações objetivas

1. Este NÃO é teste do histórico real e não comprova o aceite de out/2026 da Só Sal (8.419.049,19 / 699.003,62 / 57.248,83), porque o branch foi criado **sem dados**.
2. Não houve três dias consecutivos de confrontação com Zacarini 2.3.1.
3. Não foi testado um arquivo real de comissão do Siscom nem importação pelo Power Automate Desktop.
4. Não foi implementada `v_clientes_mes_loja`, `v_abc_dde`, `v_parado_loja`, `v_parado_rede`, OTB ou alteração em `painel.vendas` e `painel.receber`, por falta das regras/documentos/dados aprovados.
5. Não executar nada em produção sem OK escrito do Alex. Todo SQL preparado continua sujeito à revisão de negócio e segurança antes de aplicação.

## O que aprovar e obter antes da publicação

- Documento integral da Fase 2 2.3.1 com fórmulas e teste de aceite, além de `view_clientes_novos_ativos.sql`.
- Fonte oficial do Relatório de Comissão com representante e seções de bonificação e conjugadas, para validar outubro/2026 e fazer o backfill jan/2025→presente.
- Cadastro de representantes (inclusive e-commerce e futuras lojas) e decisão formal para conjugadas de múltiplos representantes.
- Critérios de completude para D-15 do RPA e responsabilidade por execução diária.
- Autorização escrita do Alex para implantação em produção.
