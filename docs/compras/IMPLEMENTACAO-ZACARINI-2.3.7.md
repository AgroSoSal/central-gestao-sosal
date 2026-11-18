# Compras — rastreio de implementação Zacarini 2.3.7 (18/11/2026)

Referência: arquivo enviado **Gestão Zacarini - Painel 2.3.7.xlsx**.
Não importar dados da planilha: ela documenta as fórmulas e regras; os dados operacionais vêm exclusivamente do Supabase.

## Implementado nesta branch
- **Pedidos de Compra!AP / AL**: decisão 'Já pago' passa a existir no cadastro, na auditoria SQL e na previsão. Não gera parcelas.
- Condições sem cobrança: bonificação, garantia, amostra grátis. Prazo **ent** = 0 dias a partir da chegada. Condição **10x** recebe os dez prazos 30–300 dias documentados em Pedidos de Compra!R292:AA292; outras condições Nx sem calendário explícito continuam pendentes de conferência, nunca estimadas.
- **Pedidos de Compra!H5:H7**: códigos de produto 545 e 105329 passam a ser protegidos por padrão na conciliação, salvo configuração explícita via variável de ambiente. Nenhum histórico do SISCOM é alterado.
- Grupos **5 e 6** excluídos das compras de mercadorias elegíveis na simulação financeira.
- **Atendimento Fornecedor!L63, W63, X63**: sugestão de compra, custo negociado e margem em domínio puro com testes.
- **Verba Comprador!C8:E8 e E12:M15**: proteção de DDE abaixo de 30 dias e fator de corte em funções testáveis; depende de integração da verba aprovada para operar.
- **Atendimento Fornecedor!AP:AU e AW:BB**: rateio por necessidade e arredondamento cumulativo.
- Rota /compras/atendimento com consulta Master ao catálogo, estoque, ABC, pendências, último custo, simulação e rascunho de negociação versionado no Supabase. Não emite pedidos no SISCOM.

## Supabase — migrations já aplicadas
- compras_zacarini_237_ja_pago
- compras_zacarini_237_atendimento_catalogo_master
- compras_zacarini_237_rascunho_negociacao_master
- compras_zacarini_237_rateio_por_filial_master
- compras_zacarini_237_followup_ja_pago (permite acompanhar entregas de pedidos que já foram pagos)

As novas funções exigem JWT e perfil Master ativo; nenhum GRANT de EXECUTE ao anon. Rascunhos com RLS, sem leitura/inserção diretas pelo navegador, via RPC Master apenas.

## Fidelidade ampliada em 18/11/2026
- **Atendimento!H15:H18**: prazo de entrega, número de parcelas, 1º vencimento e intervalo são campos editáveis; simulação das parcelas e datas, sempre sem gerar contas a pagar.
- **Atendimento!K22:K27**: conferência própria por fórmula e estado `ok`, `erro`, `pendente`, `nao_aplica`. K22 verifica PMP versus giro de custo futuro; K23 primeiro vencimento não antes da liberação financeira; K24 parcelas acumuladas versus limite acumulado; K25 verba livre por linha; K26 quantidades órfãs; K27 só autoriza se todas as verificações tiverem dado oficial. Campo ausente = **pendente**, jamais aprovação.
- **Atendimento!AO6, AW6/AW8**: textos de WhatsApp e e-mail por itens, quantidade, desconto, entrega, frete, fornecedor, comprador; exibidos como **RASCUNHO** se não há liberação da compra.
- **Plano de Estoque!K:P**, OTB!P:U: 56 subgrupos com metas combinadas manualmente para seis meses, 336 premissas versionadas em `public.compras_dde_plano_237`. A RPC Master lê metas por SKU/competência. Para subgrupos sem meta manual, a aba OTB interpola o DDE observado da própria posição financeira de estoque rumo à meta de linha, pelos percentuais 30%,55%,75%,87%,95%,100%. Falha na posição de estoque = sem sugestão homologada. Somente 46 dos 56 nomes dos subgrupos planejados coincidem integralmente com o cadastro atual; os demais não são associados automaticamente por aproximação.
- **Cad_Despesas!A5:H46** / **Atendimento!A48:I58**: 42 códigos (34 de despesas, 8 de investimentos) versionados em `public.compras_despesa_catalogo_237`, incluindo as correções de área/conta dos códigos 106399/106400 para INDUSTRIAL / MANUT MAQUINAS, sem mudar o catálogo bruto SISCOM. Formulário com até 8 itens, custo por quantidade, classificação, rascunho próprio no Supabase, sem consumir verba da OTB de mercadorias nem autorizar despesas acima do orçamento.
- **Segurança**: todas as novas RPCs de consulta e salvamento requerem Master autenticado; anon sem EXECUTE; catálogo/plano/rascunhos com RLS e sem acesso direto a dados privados.

## Supabase — migrations adicionais já aplicadas
- compras_plano_estoque_237_metas_master
- compras_plano_estoque_237_metas_manuais_56_subgrupos
- compras_zacarini_237_catalogo_42_despesas_investimentos

## Diferenças e condições para homologação
1. **Filiais SO SAL**: nomes variam conforme a extração e foram confirmados pelo usuário; manter o mapeamento atual, sem alterar as notas fiscais do SISCOM.
2. **K22/K23/K24/K25 ainda sem todas as fontes reais**: `Projeção 12M` homologada 0 meses e `v_alex_saldo_abertura_fluxo` 0 linhas. Não usar CMV histórico 90d no lugar do **custo diário previsto** (Excel AD63); não usar saldo bancário parcial no lugar do teto de caixa acumulado OTB!B33:AA41; não inventar saldo de verba S7:S10 nem disponibilidade de orçamento por grupo para despesas. O motor da fórmula está implementado, mas a liberação não está ativa até as fontes serem confiáveis.
3. **Parcelas manuais/entregas fracionadas e condições Nx não parametrizadas**: sem calendário homologado não são convertidas automaticamente; é necessária gravação versionada por pedido.
4. **Atendimento**: fora da faixa Nov/26–Abr/27, exigir nova competência de metas de plano em vez de reaproveitar 2.3.7 indefinidamente.
5. **Aprovação final**: ainda falta fluxo com assinatura/auditoria, integração de emissão SISCOM e homologação com usuário Master no navegador.
6. Migrações remotas já executadas; não reaplicar as versões no banco de produção.

## Segurança de operação
- Não tocar em public.fn_listar_pedidos_compra_conciliados.
- Não executar REFRESH pesado ou processamento integral da API durante abertura da tela.
- Tratar erro ou fonte ausente como indisponível, não como saldo zero e não como autorização de compra.
