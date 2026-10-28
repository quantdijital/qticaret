import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { CustomerConsents } from "@/features/customers/api/customers"
import { ConsentCard } from "./consent-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const consents: CustomerConsents = {
  email: {
    address: true,
    consent: { status: "granted", source: "checkout", changed_at: "2026-10-20T10:00:00Z" },
  },
  sms: { address: false, consent: null },
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConsentCard customerId="cus_1" />
    </QueryClientProvider>
  )
}

describe("ConsentCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ consents })
  })

  it("shows each channel's answer and where it came from; no phone, no switch", async () => {
    renderCard()

    expect(await screen.findByText(/İzin var · ödeme sırasında/)).toBeInTheDocument()
    expect(screen.getByText("Bu kanal için adres ya da telefon yok.")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "E-posta" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "SMS" })).toBeDisabled()
  })

  it("records a withdrawal the customer asked for", async () => {
    renderCard()
    await userEvent.click(await screen.findByRole("switch", { name: "E-posta" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/customers/cus_1/consents", {
        method: "POST",
        body: { channel: "email", status: "revoked" },
      })
    })
  })
})
