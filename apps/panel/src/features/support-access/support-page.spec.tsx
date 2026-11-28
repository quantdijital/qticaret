import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SupportPage } from "./support-page"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const fetchMock = vi.fn<typeof fetch>()

function renderPage(hash: string) {
  window.history.replaceState(null, "", `/support${hash}`)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SupportPage />
    </QueryClientProvider>
  )
}

describe("SupportPage (adr/0061 Ek Destek erişimi)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
    navigate.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // First: the fragment, once read, is kept for the page's path (`linkParams`)
  it("asks for a new link when there is no grant", async () => {
    renderPage("")

    expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantıda giriş izni yok")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("redeems the grant from the fragment once, takes it out of the address bar and goes home", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ support: { expires_at: "2026-11-28T11:00:00.000Z" } }))
    )
    renderPage("#grant=abcdefghijklmnopqrstuvwxyz")

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect(window.location.hash).toBe("")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("/auth/support-access")
    expect(JSON.parse(init?.body as string)).toEqual({ grant: "abcdefghijklmnopqrstuvwxyz" })
  })

  it("says why a used link does not open", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "support.grant_used" }), { status: 409 })
    )
    renderPage("#grant=abcdefghijklmnopqrstuvwxyz")

    expect(await screen.findByRole("alert")).toHaveTextContent("Bu bağlantı daha önce kullanıldı")
    expect(navigate).not.toHaveBeenCalled()
  })
})
