# OTB — paridade com as fórmulas da Zacarini 2.3.7 (19/11/2026)

## Confirmado na referência e implementado

- `OTB!G = D / soma(D da linha)`: a base do peso médio é **venda prevista dos 90 dias**, não CMV histórico.
- `OTB!AY:BD` e `fx_VendaSubgrupo!C:G`: vendas **entregues** nos mesmos quatro períodos móveis de três meses do ano anterior, com chave normalizada (`OTB!BK`). As vendas devem ser consolidadas entre filiais, com uma única ocorrência por origem, sem duplicar produto.
- `OTB!BL`: chaves repetidas repartem a venda histórica na razão de `D` do grupo, ou igualmente quando a soma de D é zero.
- `OTB!BE:BG/BO`: se o subgrupo vendeu menos de R$ 5 mil na janela ou a linha não vendeu, adota o peso médio `G`; nos demais casos, `venda do subgrupo na janela / venda da linha na janela`.
- `OTB!BH:BJ/BP`: pesos anteriores normalizados dentro da linha; o divisor zero conserva `G`.
- Novo motor puro `otb-seasonal-weights.ts` reproduz a regra e confere os valores da Nutrição obtidos no próprio arquivo, inclusive quatro janelas e subgrupos abaixo do piso de R$ 5 mil.
- Desde 19/11/2026, a tela `/compras/otb` consulta `fn_otb_venda_sazonal_237` e `fn_otb_abc_previsao_237` (somente leitura, Master). A segunda RPC calcula `ABCEstoque_DDE!D:P`, `OTB!D/E/F` e a curva A de cada subgrupo com dados operacionais Supabase e **60 custos unitários versionados** da aba Produção Própria. A distribuição da previsão usa `G` de vendas futuras e pesos `BH/BI/BJ/BP`. Sem a RPC, a simulação continua explicitamente marcada como proxy CMV. Mesmo conectada, a OTB permanece **simulação**, não orçamento aprovado.

## Fontes encontradas no Supabase

- `painel.mv_venda_mes_subgrupo` e `painel.v_venda_mes_subgrupo` já possuem `mes_calendario`, `visao`, `linha`, `grupo_subgrupo`, `vda_bruta` e filiais, com histórico materializado. Para Nutrição / Mineral e Proteico, a soma da visão `saida` entre dezembro/2025 e fevereiro/2026 corresponde, à unidade arredondada, ao `fx_VendaSubgrupo!C7` da fotografia (R$ 3.221.151). Esse confronto não demonstra igualdade de todas as séries nem atualização na mesma data-base.
- A migration `otb_venda_sazonal_master_237_20261119` criou a rota `public.fn_otb_venda_sazonal_237(date)` protegida por `auth.uid()` + `profiles.role='master' AND ativo`. Conferido em 19/11/2026: **109 subgrupos, 6 competências de histórico nas quatro linhas**, sem `REFRESH` e sem alteração dos extratos RPA; o perfil `anon` não pode executar. SQL em `docs/compras/otb_venda_sazonal_237.sql`.
- `public.compras_dde_plano_237` contém metas por subgrupo e competência; o motor atual já as lê. As dez divergências por caracteres acentuados têm associação literal reconstruível e única, sem equivalência entre filiais.
- `painel.mv_abc_janelas` contém 8.866 linhas de SKU × filial, base 18/11/2026. A consulta consolidada sem escrita encontrou **109 subgrupos**, venda projetada 90d de cerca de R$ 28,59 milhões e CMV projetado de cerca de R$ 21,81 milhões, com **14 possíveis produtos Só Sal não referenciados** na lista de custos da Produção Própria. A função protegida está em `docs/compras/otb_abc_previsao_237.sql`, com concessão somente para `authenticated` e verificação de Master ativo. Esses valores variam com a atualização do Supabase; não são dotações financeiras.

## Fontes ainda não disponíveis como contrato operacional completo

| Fórmula Excel | Entrada indispensável para paridade no sistema |
|---|---|
| `ABCEstoque_DDE!N/O/P` → `OTB!D/E/F` | **Ligado à prévia:** cresce a base do ano anterior por produto (ou subgrupo), usa a loja nova de 90d, aplica limite de crescimento 0–4 e custos da versão 2.3.7. Faltam a homologação dos custos e a reconciliação por SKU para uso oficial. |
| `OTB!AY:BP` | **Ligado:** quatro janelas da venda `saida` por subgrupo e linha, leitura agregada e autenticação Master. A interpretação bloqueia cobertura menor que seis meses por linha. |
| `OTB!H` | **Ligado à prévia:** identifica curva A pelo lucro bruto projetado acumulado de até 80%, com exclusão de matéria-prima, como `ABCEstoque_DDE!U/V`. |
| `OTB!I/J/V/AE/AN` | Estoque a custo menos liquidação, pedidos elegíveis anteriores e compras gravadas em cada mês, reconciliadas por item e data; datas de chegada reais não existem para toda a carteira. |
| `OTB!S173/AB173/AK173` | Matéria-prima agregada e produção própria com parâmetros aprovados. |
| `OTB!B21:D31` | Teto de caixa pelo pior caso financeiro, sem somar contas a pagar importadas duas vezes; cenário oficial ainda não homologado. |

## Condição de implementação fiel

Conectar e validar as **demais** fontes numa API de somente leitura protegida por Master. Depois alimentar `calculateOtb` (já conferida com 1.833 comparações da planilha na auditoria anterior) com pedidos por entrega, MP e caixa aprovados. O painel somente pode marcar **OTB liberada** quando os dados e a autorização financeira estiverem homologados. As funções sazonais e ABC são consultas sem DML, autorizadas pelo usuário.
