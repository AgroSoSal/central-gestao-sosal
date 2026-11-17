# Zacarini 2.2.24: catálogo de fórmulas transferidas ao Supabase

**Referência lida:** arquivo fornecido pelo usuário em 17/11/2026, \`Gestão Zacarini - Painel 2.2.24(8).xlsx\`. O arquivo possui 71 abas e aproximadamente 585.732 elementos de fórmula no XML original. Foi lido diretamente, inclusive fórmulas Excel e valores calculados armazenados.

**Escopo exclusivo:** banco Supabase. O ERP Web, GitHub \`main\`, Vercel e rotinas de produção NÃO foram alterados. A planilha é **referência de fórmula**, não origem persistente. Todos os resultados devem ser calculados no Supabase a partir de dados oficiais e auditáveis.

**Nota de versão:** esta referência é 2.2.24; o Alex citou **2.3.1** como escopo final. Onde houver diferença, NÃO atualizar a regra sem revisão. Parâmetros marcados "CONFIRMAR" na planilha não constituem política oficialmente homologada.

## Correspondência auditável de fórmula → SQL

| Regra | Origem Excel | Fórmula / significado | SQL preparado |
|---|---|---|---|
| Crescimento com fallback produto/subgrupo | \`ABCEstoque_DDE!J22:M22\` e \`B13:B14\` | usar crescimento do produto, senão subgrupo, senão 1; limitar entre piso e teto | \`painel_interno.zac_v224_crescimento_limitado\` |
| Previsão sazonal 90 dias | \`ABCEstoque_DDE!N22\` | crescimento × (quantidade mesmo período AA + ajuste outras lojas) + quantidade extra | \`painel_interno.zac_v224_previsao_90d\` |
| DDE físico | \`ABCEstoque_DDE!S22:T22\` | estoque quantidade ÷ (previsão quantidade / dias); não inventar cobertura se previsão nula/zero | \`painel_interno.zac_v224_dde\` |
| Curva ABC | \`ABCEstoque_DDE!U22:V22\`, \`B15:B16\` | margem **prevista** positiva, acumulado de maior ou igual; A até 80%, B até 95%, C demais; MP excluída | \`painel_interno.zac_v224_curva\` (classificador; ranking ainda exige previsão aprovada) |
| Estoque acima da meta e pedido | \`OTB!Q48: S48\` | para tipo S, \`MAX(0,Q+K-R)\`; P/M/N não entram direto no mesmo cálculo | \`painel_interno.zac_v224_necessidade_otb\` |
| Teto mensal de caixa | \`OTB!B17:B21\` | vem do **pior caso correto** da \`Projeção 12M\`; não usar caixa total nem taxa artificial | \`painel.zac_v224_otb_mes.teto_pior_caso\`, fonte obrigatória |
| MP com prioridade | \`OTB!B31\`, \`T173\` | saldo pós-MP \`MAX(0,teto-S173)\`; liberar MP \`MIN(S173,teto)\` | \`painel_interno.zac_v224_liberacao_mp\` |
| Rateio verba S Curva A / cauda | \`OTB!T48\` | parcela de Curva A primeiro, depois cauda, limitada pelo caixa disponível após MP | \`painel_interno.zac_v224_liberacao_subgrupo\` |
| Saldo do subgrupo | \`OTB!W48\` | liberado + vendas casadas aprovadas − pedidos gravados (saldo negativo preservado) | \`painel_interno.zac_v224_saldo_otb\` |
| Situação da trava | \`OTB!B29\` | SEM NECESSIDADE / LIBERADO / SÓ CURVA A + PARTE / TRAVADO, por arredondamento a centavos | \`painel_interno.zac_v224_situacao_otb\` |
| Verba comprador | \`Verba Comprador!C6:C9\`, \`E20:G20\` | 85%, proteção para DDE inferior a 30, fator de corte do total e trava do saldo da linha | \`painel.v_zac_v224_otb_previa\` + funções privadas |
| Caixa inicial | \`Fluxo de Caixa!B6\` → \`Extratos_Bancos!I16\` | soma dos saldos de fechamento OFICIAIS das contas; conferência \`D+E+F+G-I\` | \`painel.v_zac_saldo_abertura_fluxo\`, \`painel.v_zac_extratos_conferencia\` |
| Pesos da remuneração | \`Rem Parâmetros!D13:D18\` | vendas 25%, margem 25%, DDE 15%, despesas 15%, inadimplência 10%, clientes 10% | \`painel_interno.zac_v224_premio_kpi\` (peso explícito) |
| Multiplicadores de prêmio | \`Rem Parâmetros!C23:D26\` | abaixo 80%=0; 80–<100%=0,5; 100–<120%=1; >=120%=1,5 | \`painel_interno.zac_v224_multiplicador_premio\` |

**Parâmetros de referência observados, NÃO lançados em produção:** crescimento mínimo 0, máximo 4; janela 90 dias; Curva A 80%, B 95%; alerta DDE >60 dias (planilha marca *CONFIRMAR*); remuneração KPI 25/25/15/15/10/10; reserva 85/15; DDE protegido do comprador <30; DDE alvo por linha Nutrição 45, Saúde 60, Outros 60, Pastagem 45; meta de matéria-prima associada a prazo + dias de segurança. Não transportar automaticamente essas regras para a revisão 2.3.1.

## Conferências matemáticas com a pasta original

Foram conferidos por aritmética independente, usando fórmulas e valores armazenados na referência, 9 cálculos: crescimento M22, previsão N22, DDE T22, necessidade OTB S53, liberação MP T173, 85% E20, limite da linha E12, saldo de abertura do fluxo B6, prêmio KPI E13. **9/9 reproduziram os valores armazenados no XLSX, dentro da precisão do Excel**.

Isso NÃO é validação das funções em PostgreSQL. O arquivo \`supabase/tests/zacarini_v224_formulas_sinteticas.sql\` ainda precisa rodar em instância isolada.

## Dados disponíveis e lacunas

- Disponíveis no Supabase atual: \`painel.estoque\`, \`painel.produtos\`, \`painel.v_abc_janelas\`, \`painel.vendas\`, \`"Só Sal".v_margens\`, \`"Só Sal".rpa_importacoes/rpa_linhas\`. Não confundir filial de estoque com **loja = representante** para margem e clientes.
- Não localizados como fonte VALIDADA: relatório oficial de comissão completo, representações comerciais no título, premissas futuras 12M por linha com cenários, extratos bancários diários conciliados, todos os limites aprovados na revisão 2.3.1.
- Tabelas de entrada \`painel.zac_v224_otb_mes\` e \`painel.zac_v224_otb_insumos\` começam vazias e só são computadas quando \`cargas_conciliadas=true\` e existe aprovação. Não simular teto do pior caso nem saldo bancário.
- Os saldos bancários **não** são lidos da planilha: \`painel.zac_extrato_saldos_diarios\` deve receber o extrato oficial de cada conta (saldo, variação, transferência). Sem cobertura completa e conferência, \`v_zac_saldo_abertura_fluxo\` retorna vazio. Não existe caixa inicial manual obrigatório se a fonte fornecer o saldo de fechamento.
- As views/tabelas financeiras permanecem privadas, não abertas a \`anon\`; configurar conexão autorizada da planilha externa separadamente após homologação.

## Etapas para finalizar

1. Testar a cadeia de migrações **em PostgreSQL isolado** (as três migrações de referência acima ainda não foram executadas em banco de teste).
2. Implantar ETL oficial para previsões por subgrupo e saldos bancários, com histórico, integridade, antifraude e reconciliação.
3. Exigir formulação e versões finais da 2.3.1 e o cadastro de representantes; não inventar categoria de operação.
4. Validar 3 dias com números reais, incluindo custo financeiro, margens, caixa e extratos, e obter autorização escrita do Alex.
5. Só então promover ao Supabase de produção. Nenhuma alteração ao ERP Web.
