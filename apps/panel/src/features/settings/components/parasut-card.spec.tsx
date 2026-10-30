import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ParasutStatus } from "@/features/settings/api/einvoice"
import { EinvoiceConnectionCard } from "./parasut-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ Link: () => null }))

const AUTHORIZE = "https://api.parasut.com/oauth/authorize?client_id=x"
const CONNECTED: ParasutStatus = {
  available: true,
  authorize_url: AUTHORIZE,
  connection: {
    company_id: "123456",
    status: "connected",
    last_error: null,
    connected_at: "2026-10-30T18:46:00.000Z",
    checked_at: null,
  },
}

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EinvoiceConnectionCard provider="parasut" />
    </QueryClientProvider>
  )

describe("EinvoiceConnectionCard (Paraşüt)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("connects with the company number and the pasted code, Paraşüt's page a link away", async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      Promise.resolve({
        parasut: init?.method === "POST" ? CONNECTED : { ...CONNECTED, connection: null },
      })
    )
    renderCard()

    expect(await screen.findByRole("link", { name: /Paraşüt'te izin ver/ })).toHaveAttribute(
      "href",
      AUTHORIZE
    )
    await userEvent.type(screen.getByLabelText("Firma numarası"), "123456")
    await userEvent.type(screen.getByLabelText("Yetki kodu"), "kod-abc12345")
    await userEvent.click(screen.getByRole("button", { name: "Bağla" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/einvoice/parasut", {
        method: "POST",
        body: { company_id: "123456", code: "kod-abc12345" },
      })
    })
    expect(await screen.findByText("Bağlı")).toBeInTheDocument()
    expect(screen.queryByLabelText("Yetki kodu")).toBeNull()
  })

  it("keeps the form folded once connected, and opens it to connect again", async () => {
    fetchMock.mockResolvedValue({ parasut: CONNECTED })
    renderCard()

    expect(await screen.findByText("Firma no 123456")).toBeInTheDocument()
    expect(screen.queryByLabelText("Yetki kodu")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Yeniden bağla" }))

    expect(screen.getByLabelText("Yetki kodu")).toBeInTheDocument()
  })
})
