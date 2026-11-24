import { describe, expect, it } from "vitest"
import { assessOtbGoLive, type OtbGoLiveStatus } from "./otb-go-live-readiness"

const base: OtbGoLiveStatus = {
  data_base: "2026-11-23",
  caixa: { contas: 14, saldos: 14, conciliadas: 0, faltando_extrato: 0,
    caixa_oficial_conciliado: false, saldo_operacional_parcial: 1622378.39 },
  arquivos: { importados: 21, auditados: 21, divergentes: 0,
    cargas_anteriores_sem_ateste: 1, reenvios_sem_movimento_informado: 2 },
  premissas: { referencias: 749, homologadas: 0, versoes_financeiras: 0 },
  projecao: { linhas_homologadas: 0, horizonte_completo: false },
  pendencias: [],
  teto_otb_autorizado: false,
  ressalva: "Base parcial.",
}
describe("homologação do OTB: nunca liberar por suposições", () => {
  it("bloqueia cadastro operacional atual sem conciliação ou projeção homologada", () => {
    const result=assessOtbGoLive(base)
    expect(result.available).toBe(true)
    expect(result.safeToRelease).toBe(false)
    expect(result.blockers.join(" ")).toMatch(/Conciliar|homologar/i)
  })
  it("rejeita retorno nulo, campos inválidos e ausência de fonte", () => {
    expect(assessOtbGoLive(null).safeToRelease).toBe(false)
    expect(assessOtbGoLive({ ...base, caixa: { ...base.caixa, contas: NaN } }).available).toBe(false)
  })
  it("ainda exige autorização explícita de teto mesmo com 12 meses e contas conciliadas", () => {
    const apparentlyComplete: OtbGoLiveStatus = {
      ...base,
      caixa:{...base.caixa, conciliadas:14,caixa_oficial_conciliado:true},
      arquivos:{...base.arquivos,cargas_anteriores_sem_ateste:0},
      premissas:{referencias:0,homologadas:749,versoes_financeiras:1},
      projecao:{linhas_homologadas:12,horizonte_completo:true},
    }
    expect(assessOtbGoLive(apparentlyComplete).safeToRelease).toBe(false)
    expect(assessOtbGoLive({...apparentlyComplete,teto_otb_autorizado:true}).safeToRelease).toBe(true)
  })
  it("não exige apagar as referências históricas após homologação", () => {
    const approved: OtbGoLiveStatus = {
      ...base,
      caixa:{...base.caixa,conciliadas:14,caixa_oficial_conciliado:true},
      arquivos:{...base.arquivos,cargas_anteriores_sem_ateste:0},
      premissas:{referencias:749,homologadas:25,versoes_financeiras:1},
      projecao:{linhas_homologadas:12,horizonte_completo:true},
      teto_otb_autorizado:true,
    }
    const result=assessOtbGoLive(approved)
    expect(result.available).toBe(true)
    expect(result.safeToRelease).toBe(true)
    expect(result.blockers).toHaveLength(0)
    expect(assessOtbGoLive({
      ...approved,premissas:{...approved.premissas,homologadas:0},
    }).safeToRelease).toBe(false)
    expect(assessOtbGoLive({
      ...approved,premissas:{...approved.premissas,versoes_financeiras:0},
    }).safeToRelease).toBe(false)
    expect(assessOtbGoLive({
      ...approved,teto_otb_autorizado:false,
    }).safeToRelease).toBe(false)
  })
  it("bloqueia aprovação quando a RPC ainda relata pendência operacional explícita", () => {
    const approved: OtbGoLiveStatus = {
      ...base,
      caixa: {...base.caixa, conciliadas: 14, caixa_oficial_conciliado: true},
      arquivos: {...base.arquivos, cargas_anteriores_sem_ateste: 0},
      premissas: {referencias: 0, homologadas: 749, versoes_financeiras: 1},
      projecao: {linhas_homologadas: 12, horizonte_completo: true},
      teto_otb_autorizado: true,
    }
    expect(assessOtbGoLive(approved).safeToRelease).toBe(true)
    expect(assessOtbGoLive({
      ...approved,
      pendencias: [{tipo: "CONCILIACAO_BANCARIA_PENDENTE", conta: "conta-1", descricao: "Sem homologação"}],
    }).safeToRelease).toBe(false)
    expect(assessOtbGoLive({
      ...approved, caixa: {...approved.caixa, faltando_extrato: 1},
    }).safeToRelease).toBe(false)
    expect(assessOtbGoLive({
      ...approved, arquivos: {...approved.arquivos, auditados: 20},
    }).safeToRelease).toBe(false)
    expect(assessOtbGoLive({
      ...approved, arquivos: {...approved.arquivos, divergentes: 1},
    }).safeToRelease).toBe(false)
  })
  it("rejeita payload incompleto, mesmo se apresentar liberação no campo booleano", () => {
    const invalid = {...base, teto_otb_autorizado: true, caixa: {...base.caixa, faltando_extrato: NaN}}
    expect(assessOtbGoLive(invalid).available).toBe(false)
  })
  it("não interpreta prova interna de importação como conciliação bancária", () => {
    const result=assessOtbGoLive({...base,arquivos:{...base.arquivos,cargas_anteriores_sem_ateste:0}})
    expect(result.safeToRelease).toBe(false)
    expect(result.blockers.some(b=>b.includes("bancos"))).toBe(true)
  })
})
