# Consolidação da previsão de compras — extensão aprovada

**Solicitação:** Euller, 16/11/2026: concluir validações e publicar uma versão única.

## Referência verificável

- A Zacarini calcula saldo financeiro por item como `(quantidade pedida - quantidade recebida) * custo unitário` e parcela até 10 vezes a partir da chegada prevista.
- Chegada estimada é `MAX(data-base, data do pedido) + 7 dias`; ausência de condição de pagamento utiliza 30 dias, com identificação da estimativa.
- A decisão vazia participa da **simulação financeira**, mas continua aguardando aprovação operacional; `Segurar` e `Cancelar` excluem o saldo da projeção. O status `Já pago` da planilha não existe nas decisões autorizadas do ERP, portanto não será presumido.
- Parcelas com vencimento antes da data-base, dentro das 26 semanas e posteriores são discriminadas, sem perda de centavos.
- Na planilha, subgrupos de despesa `5.` são excluídos da linha de compras do fluxo de caixa para evitar duplicidade. A RPC de conciliação **não expõe grupo/subgrupo**, portanto o ERP não pode afirmar que os valores já são o lançamento final do caixa. Exibir como simulação bruta, com ressalva explícita e sem gravação em caixa/OTB.

## Extensão

- Manter a paginação de 50 itens para inspeção detalhada; apresentar um painel **global separado**, carregado progressivamente com as RPCs autenticadas de leitura já existentes (tamanho máximo de 100 itens por página).
- Reaproveitar por até três minutos o resumo na memória do navegador e apenas do mesmo usuário autenticado, para que a troca de página não repita a carteira inteira. O botão de recálculo ignora o resumo anterior.
- Só apresentar totais globais quando **todas** as páginas forem conciliadas, decisões e Follow-up consultados, contagem total e IDs verificados; nunca apresentar soma parcial como consolidada.
- Verificar modificações do conjunto durante a leitura pela contagem total retornada em cada lote e identidade de linha; erros oferecem nova tentativa, não um zero enganoso.
- Aplicar exatamente a mesma função de previsão aos itens globais e da tabela, incluindo entrega parcial, decisões, previsão registrada e condição de pagamento. Permitir recálculo para refletir o Follow-up editado.
- Sem gravações em Supabase, alterações de schema, edição de pedidos ou emissão de contas a pagar. Deploy único após testes.

## Critérios de aceite

1. 220+ lotes podem ser processados sem confundir 50 itens da UI com os totais da carteira.
2. Falha de qualquer lote, decisão ou Follow-up impede a etiqueta "global consolidado".
3. Sem duplicação de linha; importação/linha Excel formam a identidade física, mesmo se pedido e SKU coincidirem.
4. Entrega parcial gera parcelas apenas sobre o saldo restante e é identificada na tabela.
5. Mudança em `previsao_entrega` altera vencimentos após novo cálculo.
6. Condições de pagamento não interpretáveis exigem revisão, não um vencimento inventado.
