# Mascot Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a experiência de acesso à Compras com o mascote puxando o formulário na abertura e na autenticação bem-sucedida.

**Architecture:** Manter autenticação Supabase existente. Adicionar `intro` / `form` / `success` como estágios visuais controlados no componente do login, com keyframes CSS e PNGs locais. Esperar a saída animada antes de `router.refresh()` apenas quando o login tiver êxito.

**Tech Stack:** Next.js App Router, React 19, Tailwind 4, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-mascot-login-design.md`

## Global Constraints

- Nenhuma alteração no banco, auth backend, RLS, migrations ou deploy.
- Usar PNG oficial do Boi e logo Só Sal, sem dependências novas.
- Preservar autenticação Master e `prefers-reduced-motion`.
- Não fazer commit sem autorização do usuário.

## Review Focus

- Credenciais inválidas: formulário permanece visível e erro anunciado.
- Login bem-sucedido: transição `success` antes de `router.refresh()`.
- Falha de configuração: alerta de indisponibilidade visível sem efetuar login.
- Preferência por reduzir movimento: sem espera longa ou animação de deslocamento.
- Teclado/celular: formulário oculto não é focável; botão de entrada é acessível.

---

### Task 1: Transições do login e autenticação

**Files:**
- Modify: `src/components/compras/compras-auth.tsx`
- Create: `src/components/compras/compras-auth.test.tsx`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient`, `useRouter`, `MascotAnimation`.
- Produces: `ComprasLogin({ configured }: { configured: boolean })`, com `intro`, `form`, `success`.

- [ ] Escrever testes de abertura, falha de credenciais, transição de sucesso e configuração.
- [ ] Rodar `npm test -- src/components/compras/compras-auth.test.tsx`; observar falha adequada.
- [ ] Implementar estágio visual e preservar chamada `auth.signInWithPassword`.
- [ ] Rodar testes e confirmar aprovação.

### Task 2: Direção visual, marca e acessibilidade

**Files:**
- Add: `public/brand/sosal-mascot.png`, `public/brand/sosal-logo.png`
- Modify: `src/app/globals.css`
- Modify: `src/components/compras/compras-auth.tsx`

**Interfaces:**
- Consumes: estados de login da Task 1.
- Produces: animação CSS do Boi puxando a tela e layout responsivo dark.

- [ ] Implementar assets, layout com boas-vindas, formulário e estados de saída.
- [ ] Respeitar `prefers-reduced-motion` e affordances do teclado.
- [ ] Verificar visual desktop/mobile em navegador ou screenshot quando disponível.
- [ ] Rodar `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
