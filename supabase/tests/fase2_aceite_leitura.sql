-- ROTEIRO DE HOMOLOGAÇÃO (SQL SELECT; executar APENAS no banco de testes,
-- DEPOIS de aplicar as 3 migrações e carregar dados oficiais).
-- Não há ALTER/INSERT/DELETE e nenhum valor real sensível foi comitado.

-- O mês comercial outubro/2026 corresponde a 26/09/2026–25/10/2026.
-- A coluna resultado deve ser OK; diferenças devem ser zero ao centavo.
select * from painel.v_conferencia_comissao
where mes_comercial = date '2026-10-01';

-- A conferência por filial deverá fechar a soma de margem sem conj. em dobro.
-- Comparar cada filial contra o e-mail do Alex, inclusive unidades sem atividade.
select filial,venda,margem,percentual_margem
from painel.v_margem_filial_mes
where mes_comercial=date '2026-10-01'
order by filial;

-- Loja = representante. NÃO usar filial como substituto.
select mes_comercial,representante_cod,representante,loja,categoria,venda,margem,percentual_margem
from painel.v_margem_loja_mes
where mes_comercial=date '2026-10-01'
order by representante_cod;

-- Nenhuma conjugada inter-representante pode ser rateada automaticamente.
-- Esperado: ZERO pendências antes de liberar KPI de gerentes.
select * from painel.v_comissao_conjugadas_pendentes
where mes_comercial=date '2026-10-01';

-- Uma aprovação de importação NÃO garante reconciliação histórica.
-- O arquivo de 16/11 com 392 repetições deve ficar BLOQUEADO.
select importacao_id,relatorio,linhas_informadas,linhas_reais,
       linhas_iguais_adicionais,linhas_sem_chave,estado
from painel.v_rpa_qualidade_cargas
where importacao_id in (21,31,33,34)
order by importacao_id;

-- Teste de segurança: executar separado com papel anon/autenticado no ambiente
-- isolado. SELECT em comissao_notas/rpa_linhas_normalizadas deve falhar.
-- SELECT nas views agregadas explicitamente concedidas deve funcionar.
