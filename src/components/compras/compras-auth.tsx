"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole,
  LogOut, ShieldCheck, ShoppingBag, Sparkles,
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { MascotAnimation } from "@/components/shared/mascot-loader"

type LoginStage = "intro" | "form" | "success"

export function ComprasSair() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    const client = createSupabaseBrowserClient()
    if (!client || busy) return
    setBusy(true)
    const { error } = await client.auth.signOut()
    setBusy(false)
    if (!error) router.refresh()
  }

  return (
    <button type="button" onClick={signOut} disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">
      {busy ? <><MascotAnimation compact /> Saindo...</> : <><LogOut size={15} /> Sair</>}
    </button>
  )
}

export function ComprasLogin({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [stage, setStage] = useState<LoginStage>("intro")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const emailInputRef = useRef<HTMLInputElement>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (stage === "form") emailInputRef.current?.focus({ preventScroll: true })
  }, [stage])

  useEffect(() => () => {
    if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || stage !== "form") return
    const client = createSupabaseBrowserClient()
    if (!client) {
      setError("Conexão com Supabase indisponível. Solicite a configuração ao administrador.")
      return
    }

    setBusy(true)
    setError("")
    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError("Não foi possível entrar. Confira os dados ou solicite acesso ao administrador.")
        return
      }
      setPassword("")
      setStage("success")
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
      refreshTimerRef.current = setTimeout(() => router.refresh(), reducedMotion ? 80 : 1150)
    } catch {
      setError("Não foi possível conectar. Tente novamente em instantes.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sosal-login-stage relative isolate mx-auto my-1 w-full max-w-[1190px] overflow-hidden rounded-[28px] border border-[#27405c] bg-[#071222] text-white shadow-[0_30px_110px_-42px_rgba(0,0,0,.86)] sm:my-4 sm:rounded-[36px]">
      <div className="sosal-login-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="sosal-login-aurora pointer-events-none absolute -right-24 -top-36 size-[420px] rounded-full bg-cyan-400/15 blur-[95px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-52 -left-44 size-[430px] rounded-full bg-blue-600/10 blur-[100px]" aria-hidden="true" />

      <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-9 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_5px_24px_rgba(0,0,0,.28)]">
            <Image src="/brand/sosal-logo.png" alt="Só Sal Produtos Agropecuários" width={200} height={200} className="h-full w-full object-contain" priority />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.28em] text-cyan-300">Só Sal</p>
            <p className="mt-1 text-sm font-semibold tracking-[.03em] text-slate-100">Central de Gestão</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[.07] px-3 py-2 text-[10px] font-bold uppercase tracking-[.15em] text-emerald-200 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" /> Acesso corporativo
        </span>
      </div>

      <div className="relative grid min-h-[650px] gap-5 px-5 pb-4 pt-8 sm:px-9 lg:grid-cols-[.95fr_1.05fr] lg:gap-3 lg:px-12 lg:pb-8 lg:pt-12">
        <section className="sosal-login-copy relative z-10 max-w-[480px] pb-2 lg:pt-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.07] px-3 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-cyan-200">
            <Sparkles size={14} /> Tecnologia a serviço do agro
          </span>
          <h1 className="mt-7 max-w-[520px] text-[clamp(2.6rem,5.7vw,5.25rem)] font-bold leading-[1.04] tracking-[-.06em] text-white">
            A gestão evoluiu. <span className="sosal-login-heading-glow block">O agro também.</span>
          </h1>
          <p className="mt-6 max-w-[410px] text-sm leading-7 text-[#b2c4da] sm:text-base">
            Bem-vindo à Central de Gestão Só Sal. Informação, inteligência e decisões no mesmo lugar.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-3"><ShoppingBag size={16} className="text-cyan-300" /> Pedidos de compra</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-3"><ShieldCheck size={16} className="text-emerald-300" /> Ambiente protegido</span>
          </div>
          <div className="mt-12 hidden items-center gap-3 lg:flex">
            <span className="h-px w-14 bg-gradient-to-r from-cyan-400 to-transparent" />
            <span className="text-[10px] font-bold uppercase tracking-[.28em] text-slate-500">A família do agro</span>
          </div>
        </section>

        <div className="sosal-login-scene relative isolate min-h-[650px] w-full lg:min-h-[675px]" data-stage={stage}>
          <div className="sosal-login-orbit pointer-events-none absolute left-[6%] top-[8%] size-[250px] rounded-full border border-cyan-400/10" aria-hidden="true" />
          <div className="sosal-login-orbit pointer-events-none absolute left-[-1%] top-[2%] size-[330px] rounded-full border border-blue-400/[.07]" aria-hidden="true" />

          {stage === "intro" && (
            <section className="sosal-login-intro-card absolute right-0 top-10 z-10 w-[calc(100%-32px)] max-w-[410px] rounded-[28px] border border-cyan-300/20 bg-[#0d1d32]/95 p-7 shadow-[0_26px_90px_-40px_rgba(0,0,0,.9),inset_0_1px_rgba(255,255,255,.07)] sm:p-9">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200"><Sparkles size={23} /></div>
              <p className="mt-7 text-[11px] font-bold uppercase tracking-[.22em] text-cyan-300">Sua jornada começa aqui</p>
              <h2 className="mt-3 text-[clamp(1.7rem,3vw,2.2rem)] font-bold leading-tight tracking-tight">Olá, seja bem-vindo!</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">O Boi da Só Sal vai abrir as portas para sua experiência de gestão.</p>

              {configured ? (
                <button type="button" onClick={() => { setError(""); setStage("form") }} className="sosal-login-primary mt-9 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#215bff] to-[#167bec] px-4 text-sm font-bold text-white shadow-[0_15px_34px_-12px_rgba(32,110,255,.7)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
                  Acessar plataforma <ArrowRight size={19} />
                </button>
              ) : (
                <p role="alert" className="mt-7 rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                  A conexão com o Supabase precisa ser configurada na Vercel.
                </p>
              )}
              <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400"><LockKeyhole size={13} /> Acesso exclusivo a usuários autorizados</p>
            </section>
          )}

          {stage !== "intro" && (
            <section className="sosal-login-form-panel absolute right-0 top-2 z-10 w-[calc(100%-14px)] max-w-[455px] overflow-hidden rounded-[28px] border border-cyan-200/20 bg-[#0d1b2e]/95 shadow-[0_32px_90px_-28px_rgba(0,0,0,.85),inset_0_1px_rgba(255,255,255,.065)] backdrop-blur-xl sm:top-4 sm:w-[calc(100%-24px)]" aria-label="Formulário de acesso">
              <div className="border-b border-white/[.07] bg-gradient-to-br from-[#153253]/80 to-transparent px-6 py-7 sm:px-8">
                <button type="button" disabled={stage === "success" || busy} onClick={() => { setStage("intro"); setError("") }} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-300 transition-colors hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:opacity-40">
                  <ArrowLeft size={15} /> Voltar
                </button>
                <div className="flex size-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200"><LockKeyhole size={21} /></div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[.24em] text-cyan-300">Portal seguro · Só Sal</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">Entre na sua conta</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Acesse seus pedidos e decisões com segurança.</p>
              </div>
              <div className="px-6 py-7 sm:px-8">
                <form onSubmit={submit} className="space-y-5">
                  <fieldset disabled={stage === "success" || busy} className="space-y-5 disabled:opacity-70">
                    <div>
                      <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-slate-100">E-mail corporativo</label>
                      <input ref={emailInputRef} id="login-email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seuemail@agrososal.com.br" className="sosal-login-field h-12 w-full rounded-xl px-4 text-sm text-white outline-none placeholder:text-slate-500" />
                    </div>
                    <div>
                      <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-slate-100">Senha</label>
                      <div className="relative">
                        <input id="login-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="sosal-login-field h-12 w-full rounded-xl px-4 pr-12 text-sm text-white outline-none" />
                        <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-3 inline-flex items-center text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300">
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    {error && <p role="alert" className="rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm leading-5 text-red-200">{error}</p>}
                    <button type="submit" disabled={busy} className="sosal-login-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#215bff] to-[#167bec] text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(32,110,255,.8)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60">
                      {busy ? <><MascotAnimation compact /> Entrando...</> : <>Entrar <ArrowRight size={17} /></>}
                    </button>
                  </fieldset>
                </form>
                <p className="mt-6 flex items-start gap-2 text-[11px] leading-[1.65] text-slate-400"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan-300" /> Apenas usuários com perfil Master ativo podem consultar os dados. Nenhuma conta pode se tornar Master pela interface.</p>
                <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-500"><LockKeyhole size={13} /> Sessão protegida por Supabase Auth</p>
              </div>
            </section>
          )}

          <div className="sosal-login-pull-line pointer-events-none absolute z-20" aria-hidden="true" />
          <div className="sosal-login-cow pointer-events-none absolute z-30" aria-hidden="true">
            <Image src="/brand/sosal-mascot.png" alt="" width={480} height={480} priority className="h-full w-full object-contain drop-shadow-[0_26px_23px_rgba(0,0,0,.58)]" />
          </div>
          {stage === "success" && (
            <div role="status" aria-live="polite" className="sosal-login-success absolute inset-x-0 top-24 z-20 mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-emerald-300/20 bg-[#0d2630]/95 px-5 py-8 text-center shadow-2xl">
              <CheckCircle2 size={35} className="text-emerald-300" />
              <p className="text-lg font-semibold">Identidade confirmada!</p>
              <p className="text-sm text-slate-200">Abrindo Central de Gestão...</p>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/[.07] px-5 py-4 text-[10px] font-medium tracking-[.05em] text-slate-500 sm:px-9 lg:px-12">
        <span>© Só Sal · Produtos Agropecuários</span>
        <span>Plataforma de gestão e inteligência</span>
      </div>
    </div>
  )
}
