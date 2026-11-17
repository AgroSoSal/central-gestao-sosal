# OTB — contrato de fonte oficial (pendente de aprovação)

**Data:** 17/11/2026. **Status:** integração histórica parcial, com RPC Master de leitura aplicada; sem acesso de gravação.

## Contrato read-only esperado

O motor `calculateOtb` exige um único cenário completo (`OtbInput`), com dados coerentes na **mesma data-base**:

| Campo | Coluna / origem Zacarini | Origem Supabase a homologar |
| --- | --- | --- |
| `months[3]` | `OTB!B7` e meses subsequentes | Data de referência do Fluxo de Caixa |
| `cashCaps[3]` | `OTB!B21:D21` ← `Projeção 12M!B652:D652` | **Inexistente como projeção auditada no contrato atual** |
| `mpNeeds[3]` | `OTB!S173/AB173/AK173` | Produção própria, MP, demanda, DDE e estoques projetados; **pendente** |
| `subgroups[].kind` | `OTB!C48:C172` (`S`,`P`,`M`,`N`) | Classificação com regra equivalente; **pendente** |
| `openingStock` | `OTB!I48:I172` | `painel.estoque`, mapear valor a custo e competência |
| `priorOrders` | `OTB!J48:J172` | Pedidos conciliados ainda elegíveis, sem NF recebida duplicada |
| `forecastCost[3]` | `OTB!Q/Z/AI` | Projeção de vendas e CMV mensais por subgrupo; **pendente** |
| `targetStock[3]` | `OTB!K`, `BR×AS`, `BS×AT` | DDE-alvo sazonal e custo médio diário futuro; **pendente** |
| `curveAShare` | `OTB!H48:H172` | `painel.v_abc_janelas` pode auxiliar, mas regra de participação deve ser homologada |
| `alreadyRecorded[3]` | `OTB!V/AE/AN` | Compras gravadas classificadas por mês, excluindo Segurar/Cancelar |
| `tiedSalesApproved[3]` | `OTB!U/AD/AM` | Alçada manual Master de venda casada; **pendente** |
| `excess[3]` | `OTB!AV/AW/AX` | Excesso calculado ou fonte correspondente, sem subtrair duas vezes |

## Requisitos de segurança e consistência

1. A função de leitura deverá validar **JWT e Master ativo no banco**, à maneira das RPCs de Compras já existentes. Não disponibilizar plano OTB completo em view pública ou esquema exposto anonimamente.
2. Consultar um snapshot consistente dos três meses, com data-base, identificador de cálculo/fonte e versão de premissas. Se faltarem linhas, pedidos, preço de custo ou categoria, sinalizar erro de completude; zero só quando a fonte confirmar zero.
3. A fonte deve consolidar filiais conforme escopo da Zacarini; não misturar níveis de filial e consolidado nem multiplicar itens por join com pedidos, NFs ou histórico.
4. A linha especial de MP `OTB!173` usa a necessidade agregada. Não a incluir de novo no array de mercadorias, **mesmo que a classificação cacheada da linha 173 seja `S`**.
5. Qualquer futura RPC, materialização, agendamento ou migration exige revisão e autorização independentes. **O painel não grava pedido nem modifica RPA, Supabase, histórico ou SISCOM.**

## Conferência real do Supabase em 17/11/2026

- Projeto confirmado: `API Siscom Completa`, referência `eclcqhmclfspskawdcaw`.
- Existem `painel.estoque`, `painel.vendas`, `painel.compras`, `painel.produtos`, `painel.v_abc_janelas` e dados RPA de pedidos; não existe tabela, view ou RPC de OTB, Projeção 12M ou premissas 12M.
- Estoque com atualização máxima `2026-11-17 06:09 UTC`; vendas e compras chegam a `2026-11-16`. São metadados de fonte, **não** a prova de cobertura correta por subgrupo/filial.
- O papel `authenticated` não possui `SELECT` direto em `painel.estoque` no momento da auditoria. Portanto não se deve apontar o cliente diretamente para `painel.estoque` e presumir acesso. A integração posterior exige uma RPC Master restrita ou política deliberadamente auditada.
- O scanner do Supabase aponta 13 tabelas `painel` com RLS desabilitado. Conferência dos privilégios mostrou `SELECT` para `anon` em cinco delas: `lojas`, `lotes`, `notas_canceladas`, `produtos` e `vendedores`; nenhuma dessas cinco concede `INSERT`, `UPDATE` ou `DELETE` ao `anon`. As demais tabelas não concedem `SELECT` direto a `anon`. Isso é risco de leitura conforme configuração de exposição de schemas e exige auditoria própria. Não habilitar RLS em lote sem revisar privilégios e dependências, pois isso poderia interromper consultas e jobs em produção. A autorização de usuário Master continua sendo conferida por RPC PostgreSQL.
- Foi ligada na tela uma consulta real à RPC existente `public.fn_listar_pedidos_compra` com uma linha para obter somente o resumo de importação da carteira de pedidos. A RPC simples evita o custo da conciliação de NFs quando só precisamos de telemetria. A fonte de pedidos conectada **não** habilita cálculo de OTB sem as demais fontes.
- Foi aplicada a função adicional `public.fn_otb_historico_mensal(date,date)` (SQL em `otb_historico_mensal.sql`), sem alterar as tabelas de origem. Ela agrega mês, linha 1–4, visão vendido/saída, vendas, CMV, lucro e número de registros. Produtos sem linha válida seguem como linha `0` em vez de desaparecer do consolidado. Uma consulta read-only encontrou linhas `0` em setembro/outubro de 2026, portanto há pendência de classificação. A tela local indica explicitamente a incompletude.
- Segurança da função verificada no banco: `anon` não possui EXECUTE; `authenticated` pode invocar a RPC, mas o corpo exige `auth.uid()` e Master ativo. O teste sem JWT foi negado com `42501`. O acesso positivo como Master deve ser confirmado na interface autenticada após a publicação.
- Acesso às views de títulos do RPA foi inspecionado quanto ao esquema. Os dados de títulos **não substituem** as hipóteses de recebimentos, pagamentos, despesas, saldo inicial e regras de inadimplência usadas na Projeção 12M. As views consolidadas exigem consulta potencialmente custosa, que não deve ser executada a cada abertura de tela.
- **Complemento aprovado em 17/11/2026:** `public.otb_classificacao_complementar_produto` classifica `0` (SERVICOS) como `fora_otb`, retornado pela RPC como `linha=-1`, e `104356` como Linha 4. O cadastro SISCOM é preservado. O status visual distingue registros explicitamente excluídos dos realmente não classificados. Depois da alteração, o histórico de 419.564 registros apresenta 1.354 serviços fora da OTB e **zero registros em linha 0**. Isso homologa a cobertura comercial dos 12 meses fechados, **não** o orçamento de caixa.

### Disponibilidade dos blocos da Projeção 12M

| Bloco | Situação em 17/11/2026 | Próxima condição para automatização |
| --- | --- | --- |
| Histórico de vendas, saídas, CMV e lucro mensal | RPC Master **conectada**; exceções de linha 0 conhecidas | Sanear cadastro/classificação sem mudar histórico bruto |
| Trava de 12 meses e fatores de liberação | Motor puro **implementado**, 6/6 campos conferidos | Alimentar com os cenários financeiros reais do mesmo snapshot |
| Recebimentos e pagamentos em aberto | Tabelas/views existentes, ainda sem conciliação de posição | Confirmar títulos ativos e deduplicação entre API e RPA |
| Premissas de crescimento, despesas, giro e prazo | **Sem cadastro versionado no Supabase** | Formalizar parâmetros da planilha, responsáveis, vigência e origem |
| Pior fluxo de caixa entre cenários (C613:N613) | **Inexistente** | Reconstruir fluxo completo por 12 meses e auditar contra a planilha |
| Orçamento liberado para compras | **Bloqueado** | Três tetos financeiros + DDE, MP, subgrupos e pedidos reconciliados |

Regra de operação: **não converter médias de vendas em caixa livre** e não reutilizar números históricos do XLSX como se fossem a situação atual da Só Sal.

### Dependência circular da verba de caixa

Na versão Zacarini, `Projeção 12M!B652 = SUM(B615:B618) × B638`. O fator `B638` é o mínimo de limites de caixa distribuídos nos 12 meses (`C638:N638`), e os limites usam cenários de fluxo projetado e vencimentos de compras. Os vencimentos dependem das necessidades por linha em `OTB!S/AB/AK`, que por sua vez alimentam o mês seguinte da OTB. **Não é matematicamente equivalente** substituir esse teto pela média de vendas, estoque ou calendário de 26 semanas. Será preciso portar e homologar também o modelo de caixa e suas premissas, ou armazenar em Supabase um cenário de Projeção 12M produzido por rotina confiável.

## Como homologar

Para a mesma fotografia do XLSX, o extrator local:

```bash
python scripts/extract-otb-reference.py "Gestão Zacarini.xlsx"
```

Gera na saída padrão um objeto `{ "input": {...}, "expected": {...} }`. Para importar no painel de homologação, salvar somente o objeto gerado em arquivo JSON protegido; o navegador aceita tanto o wrapper quanto o objeto `input` direto. Não adicionar o cenário real ao GitHub nem distribuí-lo publicamente.

Conferência automática (requer Python com openpyxl e Node 24):

```bash
node --experimental-strip-types scripts/compare-otb-workbook.mjs "Gestão Zacarini.xlsx"
```

Fotografia recebida em 17/11/2026: **1.833 comparações, 0 diferenças acima de R$ 0,01**. Essa evidência valida o motor com *aquelas* entradas, não a disponibilidade de dados atuais do Supabase. Antes de uso decisório, repetir os testes contra snapshot atual autorizado, validar saldos por filial/subgrupo e assegurar refresh atômico.
