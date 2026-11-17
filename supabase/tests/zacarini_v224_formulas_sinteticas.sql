-- Executar SOMENTE após as migrações 151000/152000/153000
-- em banco isolado de homologação. Todos os números são FICTÍCIOS
-- e não representam valores da Só Sal nem da planilha.
do $test$
begin
 if painel_interno.zac_v224_crescimento_limitado(1.2,1.5,0,4)<>1.2
 then raise exception 'Crescimento: precedência produto'; end if;
 if painel_interno.zac_v224_crescimento_limitado(null,1.5,0,4)<>1.5
 then raise exception 'Crescimento: fallback subgrupo'; end if;
 if painel_interno.zac_v224_crescimento_limitado(8,null,0,4)<>4
 then raise exception 'Crescimento: teto 4'; end if;
 if painel_interno.zac_v224_previsao_90d(2,10,3,5)<>31
 then raise exception 'Sazonal: previsão 90d'; end if;
 if painel_interno.zac_v224_dde(100,200,90)<>45
 then raise exception 'DDE: estoque / demanda diária'; end if;
 if painel_interno.zac_v224_dde(100,0,90) is not null
 then raise exception 'DDE: sem demanda não pode inventar infinito'; end if;
 if painel_interno.zac_v224_curva(false,.79,.8,.95)<>'A'
   or painel_interno.zac_v224_curva(false,.9,.8,.95)<>'B'
   or painel_interno.zac_v224_curva(false,.96,.8,.95)<>'C'
   or painel_interno.zac_v224_curva(true,.79,.8,.95)<>'MP'
 then raise exception 'ABC: limites / exclusão MP'; end if;
 if painel_interno.zac_v224_necessidade_otb('S',100,.6,10,30)<>40
   or painel_interno.zac_v224_necessidade_otb('P',100,.6,10,30)<>0
 then raise exception 'OTB: categoria e S=MAX(0,Q+K-R)'; end if;
 if abs(
   painel_interno.zac_v224_liberacao_subgrupo(200,.5,400,100,500,200)
   - 133.3333333333
 ) > 0.00001
 then raise exception 'OTB: prioridade MP/Curva A'; end if;
 if painel_interno.zac_v224_liberacao_mp(100,400)<>100
 then raise exception 'OTB: matéria-prima'; end if;
 if painel_interno.zac_v224_saldo_otb(100,20,130)<>-10
 then raise exception 'OTB: não pode ocultar saldo negativo'; end if;
 if painel_interno.zac_v224_situacao_otb(300,500,200)<>'SÓ CURVA A + PARTE'
 then raise exception 'OTB: trava do mês'; end if;
 if painel_interno.zac_v224_fator_comprador(200,300,100)<>.5
 then raise exception 'Comprador: corte preservando protegidos'; end if;
 if painel_interno.zac_v224_necessidade_comprador(100,.85,20,30,.5)<>85
   or painel_interno.zac_v224_necessidade_comprador(100,.85,40,30,.5)<>42.5
 then raise exception 'Comprador: DDE <30 protegido'; end if;
 if painel_interno.zac_v224_multiplicador_premio(.79)<>0
   or painel_interno.zac_v224_multiplicador_premio(.8)<>.5
   or painel_interno.zac_v224_multiplicador_premio(1.0)<>1
   or painel_interno.zac_v224_multiplicador_premio(1.2)<>1.5
 then raise exception 'Remuneração: multiplicadores'; end if;
 if painel_interno.zac_v224_premio_kpi(5000,.25,1.0)<>1250
 then raise exception 'Remuneração: peso KPI'; end if;
end
$test$;
