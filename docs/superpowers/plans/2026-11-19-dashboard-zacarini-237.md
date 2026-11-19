# Dashboard Zacarini 2.3.7 no ERP (19/11/2026)

## Objetivo

Reproduzir a **aba Dashboard** da Gestão Zacarini 2.3.7 dentro de Compras, preservando todos os blocos, regras e indicadores, mas sem qualquer dependência de execução, arquivo montado, fórmula remota ou sincronização com o Excel. O XLSX é exclusivamente uma fonte de configuração inicial/auditoria; o Supabase é a fonte de runtime.

## Regras e limites

- Indicadores da aba: velocímetros de vendas, margem e EBITDA; caixa 13 semanas; três cenários 12M e pior caso; DDE, parado, vencidos, PMR, dívida e verba; quadros por linha e loja; DRE orçamento × realizado e gráficos.
- Não copiar os resultados calculados ou valores realizados da planilha como números atuais.
- Parâmetros de planejamento do Alex são sementes **de referência, não homologadas** (origem/aba/célula/versão preservadas); parametrizações já existentes no Supabase, como as 336 metas de DDE, são reutilizadas, não duplicadas.
- Nunca promover extratos conferidos a caixa homologado; nunca calcular verba de compra oficial sem projeção integrada, cenário pior caso e aprovação.
- Consultas somente para Master ativo; nenhum segredo no frontend, nenhuma concessão de acesso amplo em `painel`.
- Não afetar tabelas RPA ou sua cadência D-15. Evitar agregação em tabelas grandes quando existem materialized views.
- Publicação depende de checagem de CI/segurança e de autorização de deploy aplicável.

## Arquitetura

1. `docs/compras/dashboard_zacarini_237_config.sql`: migração idempotente de `public.compras_dashboard_config_237`, com RLS, revogação de acesso público, funções Master apenas para leitura e edição futura, e semente de parâmetros do Excel. Campos: categoria, código, dimensão, competência, valor, unidade, origem e aprovação. Não há ponte para XLSX.
2. `src/domains/compras/domain/dashboard-zacarini-237.ts`: contratos e projeções de estado; valida valores não finitos e origens; estabelece diferenças entre referência, realizado, indisponível e homologado.
3. `src/app/compras/dashboard/page.tsx`: Server Component; sessão Supabase e Master ativo, consultas protegidas em paralelo, tratamento independente de erros. Reutiliza o histórico/estoque já exposto e a agenda parcial; DRE, vendas × metas e caixa 13 semanas só recebem valores após fontes/projeções suficientes.
4. `src/components/compras/compras-executive-dashboard.tsx`: UI escura e responsiva de **todos** os blocos da aba Dashboard, com filtros de mês/filial, gráficos de percentuais e comparação, e estado pendente honesto.
5. Links em `/compras`, `/compras/otb` e no mapa de cobertura. Nenhum código importa/parsa `.xlsx` em runtime.

## Sequência de entrega

### 1. Testes de regras e status (RED)
- Cobrir valor real vs referência (não trocar um pelo outro), condição de homologação, capacidade de manter zero real, e cobertura dos indicadores.

### 2. Modelo e parâmetros (GREEN)
- Implementar contratos e cálculo puro; conferir valores/células apenas na fonte fornecida.
- Preparar SQL idempotente e testá-lo com transação/queries seguras. RLS com Master ativo e sem grants anônimos.

### 3. Dashboard navegável
- Testar HTML de todos os blocos, incluindo DRE e quadros por linha/loja; ligar as fontes já disponíveis e marcar lacunas específicas.
- Adicionar navegação visível ao Master. Garantir autenticação server-side, filtros e responsividade.

### 4. Verificação
- `npm test`, `npm run lint`, `npx tsc --noEmit` e `npm run build`.
- Verificar no banco que sementes e funções existem, RLS/privileges/índices e dados originais intactos; testar com acesso Master e sem acesso anon quando viável.
- Comprovar ausência de acesso ao arquivo Excel no código de runtime.

## Lacunas reais confirmadas em 19/11/2026

- `painel.alex_projecao_12m`: 0 registros e view homologada 0.
- `public.otb_premissas_financeiras_12m`: 0 registros.
- `painel.alex_extratos_saldos`: 0 conciliações homologadas, apesar de 1.783 saldos e 10 contas.
- Metas de vendas e orçamento da DRE não possuem fonte oficial identificada no Supabase.
- Os blocos da Zacarini podem ser exibidos com sua definição e estado, mas suas células de resultado só ficam numéricas quando a mesma regra puder ser reproduzida com fonte aprovada.
