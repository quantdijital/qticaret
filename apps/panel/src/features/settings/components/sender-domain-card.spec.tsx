import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SenderDomainView } from "@/features/settings/api/messaging"
import { SenderDomainCard } from "./sender-domain-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const dmarc = { record: "DMARC", name: "_dmarc", type: "TXT", value: "v=DMARC1; p=none;" }

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SenderDomainCard />
    </QueryClientProvider>
  )
}

describe("SenderDomainCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says e-mail is not set up yet, in the shop's words, while Resend is not configured", async () => {
    fetchMock.mockResolvedValue({
      available: false,
      sender: "bildirim@platform.example",
      domain: null,
      dmarc,
    } satisfies SenderDomainView)
    renderCard()

    expect(await screen.findByText(/E-posta gönderimi henüz kurulmadı/)).toBeInTheDocument()
    expect(screen.queryByText(/Mailpit/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Alan adını ekle" })).toBeNull()
  })

  it("shows the records to publish and asks Resend to verify", async () => {
    const pending: SenderDomainView = {
      available: true,
      sender: "bildirim@platform.example",
      domain: {
        name: "magaza.example.com",
        local_part: "bildirim",
        status: "pending",
        records: [{ record: "DKIM", name: "resend._domainkey", type: "TXT", value: "p=abc" }],
        checked_at: null,
        verified_at: null,
      },
      dmarc,
    }
    fetchMock.mockResolvedValue(pending)
    renderCard()

    expect(await screen.findByText("p=abc")).toBeInTheDocument()
    expect(screen.getByText("v=DMARC1; p=none;")).toBeInTheDocument()
    expect(screen.getByText("Bekleniyor")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/messaging/sender-domain/check", {
        method: "POST",
        body: {},
      })
    })
  })
})
