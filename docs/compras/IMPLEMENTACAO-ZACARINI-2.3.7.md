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

## Diferenças e condições para homologação
1. **Filial SO SAL**: workbook E5:F5 mapeia para Campo Grande; ERP/Supabase atualmente tratam SO SAL como BDS. Não fazer troca silenciosa em NF e conciliação: exige evidência do código real SISCOM.
2. **Pedidos de Compra!AO/AR/AS/AT, Atendimento!K22:K27**: travas de caixa por vencimento, orçamento da linha, margem-alvo e curva dependem de Projeção 12M, DDE-alvo e limites oficialmente homologados. A nova tela permanece em simulação e bloqueia emissão operacional.
3. **Parcelas manuais/entregas fracionadas e condições Nx não parametrizadas**: sem calendário homologado não são convertidas automaticamente; é necessária gravação versionada da exceção por pedido.
4. **Atendimento**: os valores de DDE iniciais vêm de OTB!H6:H9 (45/60/60/50), mas são apenas referência da planilha; não substituir as premissas oficiais.
5. Validação Master autenticada, comparação com casos reais e testes CI antes do merge para main.
6. Migrações remotas já executadas; não reaplicar as versões no banco de produção.

## Segurança de operação
- Não tocar em public.fn_listar_pedidos_compra_conciliados.
- Não executar REFRESH pesado ou processamento integral da API durante abertura da tela.
- Tratar erro ou fonte ausente como indisponível, não como saldo zero e não como autorização de compra.
