# Entrega parcial — OTB Zacarini e Projeção 12M (17/11/2026)

## Concluído nesta etapa

- Rota protegida `/compras/otb`: consulta somente usuários Master ativos; nunca trata falha de autorização como perfil liberado.
- Motor OTB de três meses, estoque e orçamento por linha/subgrupo, com importação JSON **somente para homologação**.
- Motor de teto de pior caso dos três meses sobre o fluxo de 12 meses; os fatores e tetos coincidiram com os seis valores cacheados da planilha Zacarini recebida.
- Integração do resumo de pedidos pela RPC existente e do histórico mensal comercial por nova RPC `public.fn_otb_historico_mensal`.
- Verificações de qualidade: identificação de registros sem linha 1–4, 12 competências fechadas, visões `vendido`/`saida` e entradas numéricas completas. Erro não vira zero.
- 27 testes de domínio, integração e segurança concluídos com sucesso no ambiente Node 24.

## Supabase — já executado

A migração **`otb_historico_mensal_master_20261117` foi aplicada ao projeto `eclcqhmclfspskawdcaw`**. O SQL versionado fica em `docs/compras/otb_historico_mensal.sql` **para auditoria, não para aplicar novamente**.

A RPC não recebe gravações, `PUBLIC`/`anon` não têm `EXECUTE`, e a execução sem JWT retornou `42501`. Fontes do SISCOM, RPA e demais objetos permaneceram inalterados.

## O que ainda NÃO foi homologado

O orçamento de caixa oficial continua bloqueado: o banco atual não fornece a Projeção 12M calculada, as premissas versionadas, a conciliação futura de recebimentos/pagamentos e todas as entradas de DDE/MP/subgrupos. Os itens pendentes estão detalhados em `docs/compras/otb-contrato-dados.md`.

**Importante:** não carregar dados históricos do Excel como se fossem previsão atual. Não tomar decisões de compras com um cenário JSON de homologação.

## Publicação e verificação

Esta implementação deve ser comparada com o branch atual do repositório `AgroSoSal/central-gestao-sosal` antes do merge, preservando alterações recentes de outras funcionalidades. Verifique o commit publicado e o build de produção no histórico da Vercel. Sem dependências Next.js instaladas no ambiente de desenvolvimento inicial, o build só pode ser validado pelo pipeline de publicação ou em uma máquina com as dependências instaladas.

## Verificações locais

```bash
node --experimental-strip-types --test scripts/verify-otb.mjs scripts/verify-otb-source-status.mjs scripts/verify-otb-cash.mjs scripts/verify-otb-historical-source.mjs scripts/verify-otb-historical-sql.mjs
node --experimental-strip-types scripts/compare-otb-cash-workbook.mjs CAMINHO_DA_PLANILHA.xlsx
node --experimental-strip-types scripts/compare-otb-workbook.mjs CAMINHO_DA_PLANILHA.xlsx
```

Para build na máquina do repositório após merge: instalar dependências conforme lockfile vigente e executar os comandos `npm run test`, `npm run lint`, `npm run build`.
