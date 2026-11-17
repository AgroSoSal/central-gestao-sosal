# OTB — integração automática com Projeção 12M

**Aprovação:** usuário pediu para automatizar a Projeção 12M no Supabase em 17/11/2026.

## Intenção

Eliminar a dependência do Excel para decidir o limite de compras de três meses, preservando a matemática da Gestão Zacarini 2.2.24 e os históricos de coleta SISCOM/RPA.

## Alternativas e decisão

1. Importar números mensais já calculados do Excel: mais rápido, mas mantém dependência manual e possibilidade de dados vencidos.
2. **Reproduzir os cálculos da Projeção 12M a partir de fontes oficiais e premissas versionadas no Supabase:** escolhido porque é automático, auditável e atende a central única de dados.
3. Inferir o caixa a partir da média de vendas: rejeitado porque viola a trava de pior caso e os vencimentos por prazo.

## Decomposição obrigatória

- **Camada fonte:** vendas, compras, estoque, títulos pagos/a pagar, despesas e custos reais já presentes no banco, identificados por período e filial. Premissas inexistentes devem ficar explicitamente pendentes.
- **Modelo financeiro:** Projeção 12M com cenários `PLANO 90%`, `PLANO 100%`, `HISTÓRICO` e `PIOR CASO CORRETO`, incluindo prazo de recebimento/pagamento, estoque, capital de giro, despesas, saldos iniciais e ajustes. Um dado ausente nunca vira zero silenciosamente.
- **Trava de compras:** `B652:D652 = SOMA(necessidades por prazo dos 4 grupos) × B638:B640`, com fatores determinados mês a mês pela folga acumulada do pior caixa dos 12 meses (`C613:N613`) e vencimentos acumulados por mês da OTB (`C630:N632`). Referência da planilha: `B638:B640`, `B652:D652`, `B615:B626`, `C612:N612`.
- **Saída:** entregar três tetos validados ao motor OTB já testado e expor a origem/versão/data-base. Se qualquer premissa necessária não existir, manter cálculo indisponível, preservando a página de homologação.

## Restrições de segurança

- Somente Master ativo pode consultar valores gerenciais por RPC autenticada no banco.
- Nenhum dado de produção original, job SISCOM/RPA ou fluxo legado é alterado.
- Novas estruturas, se necessárias, são aditivas, com RLS e privilégios mínimos; sem acesso de `anon` a dados financeiros.
- Não promover resultados ainda não homologados ao painel como orçamento disponível.

## Limite descoberto em 17/11

No Supabase não há ainda Projeção 12M, premissas, curva de prazo financeiro nem versão do caixa inicial que reproduzam o workbook. É possível implementar e testar o algoritmo determinístico de liberação contra a planilha, mas **não** é correto calcular o cenário financeiro oficial a partir apenas de tabelas históricas. Sua primeira execução automática real depende do cadastro confiável das premissas e da reconstrução dos cenários de 12 meses.
