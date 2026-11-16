# Plano de implementação — Compras consolidadas

Base: `docs/superpowers/specs/2026-11-16-compras-consolidacao-integral-design.md`.

## 1. Consolidação incremental de 100 itens

1. Criar testes de domínio para mais de 100 itens, verificação de contagem/IDs, decisões e Follow-up, e falha sem totais parciais. Confirmar falha inicialmente.
2. Implementar orquestrador de leitura paginada com concorrência limitada e acumulador de centavos/semanas; testar sucesso e falha.

## 2. UX e regras da planilha

1. Criar testes de interface para estados carregando, erro, consolidado e recálculo; confirmar falha antes do componente.
2. Construir painel global independente da tabela de 50 linhas; preservar filtro e paginação, aviso de subgrupo `5.` e recálculo de Follow-up.
3. Testar recebimento parcial, prazo informado e prazo padrão.

## 3. Validação e publicação

1. Rodar todos os testes, ESLint, TypeScript e build sem secrets.
2. Revisar diff e alterações apenas frontend/domínio/docs; checar dados de referência de forma somente leitura.
3. Criar **um único commit** e atualizar `main` com lease no GitHub; conferir status e domínio no Vercel.

## Riscos e decisões

- A RPC atual limita a 100 por consulta e executa conciliação complexa. A consolidação progressiva pode levar tempo e não deve saturar o banco; concorrência moderada, cancelamento e progressão visível.
- Sem a classificação contábil no payload da RPC, os totais não representam caixa líquido deduplicado. Não integrar com o caixa até existir dado confiável.
