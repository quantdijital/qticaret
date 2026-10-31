import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { FraudBlocksCard } from "@/features/settings/components/fraud-blocks-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const blocks = [
  {
    id: "frblk_1",
    kind: "email",
    display: "ay***@example.com",
    reason: "Ters ibraz",
    expires_at: null,
    created_at: "2026-10-30T09:00:00Z",
  },
  {
    id: "frblk_2",
    kind: "ip",
    display: "203.0.113.7",
    reason: null,
    expires_at: null,
    created_at: "2026-10-30T10:00:00Z",
  },
]

describe("Settings > Security > Block list", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      Promise.resolve(init?.method ? { block: { id: "frblk_3" } } : { blocks, count: 2 })
    )
  })

  it("groups the entries by kind and adds one as typed", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FraudBlocksCard />
      </QueryClientProvider>
    )
    expect(await screen.findByText("ay***@example.com")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "E-posta" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "IP adresi" })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("Değer"), " kotu@ornek.com ")
    await userEvent.type(screen.getByLabelText("Neden (isteğe bağlı)"), "Sahte sipariş")
    await userEvent.click(screen.getByRole("button", { name: "Listeye ekle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/fraud/blocks", {
        method: "POST",
        body: { kind: "email", value: "kotu@ornek.com", reason: "Sahte sipariş" },
      })
    })
  })
})
