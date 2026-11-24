import {cleanup,render,screen} from "@testing-library/react"
import {afterEach,describe,expect,it,vi} from "vitest"

const state=vi.hoisted(()=>({
  failure:false,
  total:1,
  calls:[] as Array<{name:string;args:Record<string,unknown>}>,
}))
vi.mock("next/server",()=>({connection:async()=>undefined}))
vi.mock("@/lib/supabase/server",()=>({
  createSupabaseServerClient:async()=>({
    auth:{getUser:async()=>({data:{user:{email:"master@sosal.com.br"}},error:null})},
    rpc:async(name:string,args:Record<string,unknown>)=>{
      state.calls.push({name,args})
      return {
        error:state.failure?{code:"42501"}:null,
        data:{
          source:"SISCOM_NF_ENTRADAS_238",status:"disponivel",
          filial:"BDS",total:state.total,pagina:1,tamanho:50,
          itens:[{data:"2026-11-23",filial:"BDS",nf:"51660",produto_cod:"100144",
            fornecedor:"EMBRASATEC",qtde:94,valor:3619,
            operacao:"COMPRA MATERIA PRIMA",dev:false}],
        },
      }
    },
  }),
}))
afterEach(()=>{cleanup();state.failure=false;state.total=1;state.calls=[]})

describe("consulta geral de notas fiscais de entrada",()=>{
  it("mostra os campos da NF, sem presumir vínculo a pedido ou baixa",async()=>{
    const {ReceiptsContent}=await import("./page")
    render(await ReceiptsContent({searchParams:Promise.resolve({
      busca:"51660",loja:"SO SAL",inicio:"2026-11-01",fim:"2026-11-24",
    })}))
    expect(screen.getByRole("heading",{name:"Consulta de NFs de entrada"})).toBeInTheDocument()
    expect(screen.getByRole("table")).toHaveTextContent("51660")
    expect(screen.getByRole("table")).toHaveTextContent("100144")
    expect(screen.getByRole("table")).toHaveTextContent("R$ 3.619,00")
    expect(screen.getByText(/não vincula automaticamente/i)).toBeInTheDocument()
    expect(state.calls).toEqual([{
      name:"fn_compras_listar_nfs_entrada_238",
      args:{p_loja:"SO SAL",p_inicio:"2026-11-01",p_fim:"2026-11-24",
        p_busca:"51660",p_pagina:1,p_tamanho:50},
    }])
  })

  it("preserva pesquisa e filial ao paginar",async()=>{
    state.total=51
    const {ReceiptsContent}=await import("./page")
    render(await ReceiptsContent({searchParams:Promise.resolve({
      loja:"SO SAL",busca:"51660",
    })}))
    expect(screen.getByRole("link",{name:"Próxima"})).toHaveAttribute(
      "href","/compras/recebimentos?busca=51660&loja=SO+SAL&pagina=2",
    )
  })

  it("não exibe registros quando o acesso Master é negado",async()=>{
    state.failure=true
    const {ReceiptsContent}=await import("./page")
    render(await ReceiptsContent({searchParams:Promise.resolve({})}))
    expect(screen.getByRole("alert")).toHaveTextContent(/Acesso exclusivo ao Master/i)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
