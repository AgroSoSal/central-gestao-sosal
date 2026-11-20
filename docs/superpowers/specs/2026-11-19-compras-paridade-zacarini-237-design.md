# Paridade funcional de Compras — Zacarini 2.3.7

## Objetivo

Reproduzir no módulo Compras da Central de Gestão Só Sal as regras de cálculo da versão 2.3.7 da Zacarini, preservando fontes operacionais no Supabase e o histórico SISCOM/RPA. A planilha é referência de regras e de casos de teste, não uma base operacional a ser consultada em produção.

## Escolha técnica e alternativas

- **Escolhida: motor de domínio Next.js/TypeScript + fontes Supabase protegidas.** Mantém dados atualizados, testes de paridade por fórmula e os bloqueios de aprovação já existentes.
- Copiar valores estáticos da planilha diretamente para a tela: rejeitada; transformaria uma fotografia de 2026 em saldo atual.
- Liberar OTB com projeções incompletas: rejeitada; faltam cenário do pior caixa, aprovações e previsão integral de despesas e matérias-primas.

## Escopo e limites

1. Conferir fórmulas da Zacarini diretamente no XLSX e incluir testes regressivos independentes.
2. Conferir dois indicadores distintos: `OTB!P30/Q30` rateiam a verba **total liberada** em 90% para comprador e 10% para diretoria, inclusive a MP da linha 173 (`OTB!T173`); `Verba Comprador!C9` representa o orçamento final após cortes de caixa, proteção DDE e limites por linha. `Verba Comprador!E20/E145` usa a **necessidade bruta** por tipo `S`, não deve ser confundida com `C9`.
3. Preservar a prioridade da MP no teto de caixa e contabilizá-la **uma única vez** no rateio global, sem duplicá-la na lista de subgrupos comerciais. A paridade por linha exige validar a alocação da MP à linha da planilha.
4. Não criar aprovação financeira fictícia quando os dados estiverem ausentes. Tabelas financeiras vazias não significam caixa zero nem autorização de compra.
5. A autorização posterior do usuário permite preparar commit/publicação das correções verificadas e alterações de Supabase que se mostrem necessárias e seguras. Esta entrega não cria fonte financeira fictícia, não aprova premissas e não modifica dados brutos SISCOM/RPA; alterações de banco exigem migração revisada e validação específica antes de execução.

## Pendências que exigem ação posterior

O sistema possui interface de decisões/Follow-up e simuladores, mas precisa de registros operacionais reais, cenário 12M homologado, classificação de fornecedores/pedidos, homologação de custos/MP, fluxo de alçada e integração autorizada com SISCOM antes de ser considerado concluído. A planilha contém premissas e fórmulas, não a autorização dessas operações.
