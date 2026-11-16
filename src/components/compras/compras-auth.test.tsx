import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ComprasLogin } from "./compras-auth"

const refresh = vi.fn()
const signInWithPassword = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}))

beforeEach(() => {
  refresh.mockReset()
  signInWithPassword.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ComprasLogin — experiência com o Boi Só Sal", () => {
  it("começa na recepção e o mascote puxa o formulário ao clicar", () => {
    render(<ComprasLogin configured />)

    expect(screen.getByRole("button", { name: /acessar plataforma/i })).toBeVisible()
    expect(screen.queryByText(/o boi da só sal vai abrir as portas/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: /e-mail corporativo/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /acessar plataforma/i }))

    expect(screen.getByRole("textbox", { name: /e-mail corporativo/i })).toBeVisible()
    expect(screen.getByLabelText("Senha")).toBeVisible()
    expect(screen.getByRole("heading", { name: /entre na sua conta/i })).toBeVisible()
    expect(screen.getByRole("textbox", { name: /e-mail corporativo/i })).toHaveFocus()
    fireEvent.click(screen.getByRole("button", { name: /mostrar senha/i }))
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text")
  })

  it("mantém os campos e informa falha sem iniciar a saída", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "invalid login" } })
    render(<ComprasLogin configured />)
    fireEvent.click(screen.getByRole("button", { name: /acessar plataforma/i }))
    fireEvent.change(screen.getByRole("textbox", { name: /e-mail corporativo/i }), {
      target: { value: "usuario@agrososal.com.br" },
    })
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "incorreta" } })
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível entrar/i))
    expect(screen.getByLabelText("Senha")).toBeVisible()
    expect(refresh).not.toHaveBeenCalled()
  })

  it("anima a saída somente após sucesso e então atualiza a navegação", async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    render(<ComprasLogin configured />)
    fireEvent.click(screen.getByRole("button", { name: /acessar plataforma/i }))
    fireEvent.change(screen.getByRole("textbox", { name: /e-mail corporativo/i }), {
      target: { value: " master@agrososal.com.br " },
    })
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "secreta" } })

    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/abrindo central de gestão/i))
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "master@agrososal.com.br", password: "secreta" })
    expect(refresh).not.toHaveBeenCalled()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1250))
    })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("informa conexão indisponível sem oferecer formulário operacional", () => {
    render(<ComprasLogin configured={false} />)
    expect(screen.getByRole("alert")).toHaveTextContent(/conexão com o supabase/i)
    expect(screen.queryByRole("button", { name: /acessar plataforma/i })).not.toBeInTheDocument()
  })

  it("respeita quem prefere movimento reduzido, sem aguardar a animação de saída", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
    signInWithPassword.mockResolvedValue({ error: null })
    render(<ComprasLogin configured />)
    fireEvent.click(screen.getByRole("button", { name: /acessar plataforma/i }))
    fireEvent.change(screen.getByRole("textbox", { name: /e-mail corporativo/i }), {
      target: { value: "usuario@agrososal.com.br" },
    })
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo" } })
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce(), { timeout: 450 })
  })
})
