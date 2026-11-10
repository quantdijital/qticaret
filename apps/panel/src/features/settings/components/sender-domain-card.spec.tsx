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

  it("shows the address e-mail goes from, and no domain to add, where none can be verified", async () => {
    fetchMock.mockResolvedValue({
      sending: true,
      available: false,
      sender: "bildirim@platform.example",
      domain: null,
      dmarc,
    } satisfies SenderDomainView)
    renderCard()

    expect(await screen.findByText("bildirim@platform.example")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Gönderen adres" })).toBeInTheDocument()
    expect(screen.queryByText(/henüz kurulmadı/)).toBeNull()
    expect(screen.queryByText(/Mailpit/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Alan adını ekle" })).toBeNull()
  })

  it("says in one line that e-mails do not go out while nothing sends them", async () => {
    fetchMock.mockResolvedValue({
      sending: false,
      available: false,
      sender: null,
      domain: null,
      dmarc,
    } satisfies SenderDomainView)
    renderCard()

    expect(await screen.findByText("E-postalarınız şu an gönderilmiyor.")).toBeInTheDocument()
    // The platform's setting: nothing for the shop to do, no one to ask
    expect(screen.queryByText(/platform/i)).toBeNull()
    expect(screen.queryByText(/yönetici/i)).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("warns of the own mail server's missing records, without a button to verify", async () => {
    fetchMock.mockResolvedValue({
      sending: true,
      available: false,
      transport: "smtp",
      dns: {
        domain: "magaza.com.tr",
        spf: "found",
        dkim: "found",
        dkim_selector: "default",
        dmarc: "missing",
      },
      sender: "bildirim@magaza.com.tr",
      domain: null,
      dmarc,
    } satisfies SenderDomainView)
    renderCard()

    expect(await screen.findByText("bildirim@magaza.com.tr")).toBeInTheDocument()
    expect(screen.getByText("Yok")).toBeInTheDocument()
    expect(screen.getAllByText("Var")).toHaveLength(2)
    expect(screen.getByText(/"default" seçicisinde/)).toBeInTheDocument()
    expect(screen.getByText(/gönderim durmaz/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("offers the shop's own domain where Resend can verify it", async () => {
    fetchMock.mockResolvedValue({
      sending: true,
      available: true,
      sender: "bildirim@platform.example",
      domain: null,
      dmarc,
    } satisfies SenderDomainView)
    renderCard()

    expect(await screen.findByRole("button", { name: "Alan adını ekle" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Gönderici alan adı" })).toBeInTheDocument()
  })

  it("shows the records to publish and asks Resend to verify", async () => {
    const pending: SenderDomainView = {
      sending: true,
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
