import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { GoogleMerchantCard } from "./google-merchant-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: toastMock }))

const status = (google: Record<string, unknown>) => ({
  google: {
    configured: true,
    connected: true,
    email: "magaza@example.com",
    merchant_id: null,
    last_sync: null,
    ...google,
  },
})

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GoogleMerchantCard />
    </QueryClientProvider>
  )
}

describe("GoogleMerchantCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    window.history.replaceState(null, "", "/settings/marketing")
  })

  it("is not there at all while the platform has not opened Google (docs/06 principle 10)", async () => {
    fetchMock.mockResolvedValue(status({ configured: false, connected: false }))
    const { container } = renderCard()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google")
    })
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
    expect(screen.queryByText("Google Merchant Center")).not.toBeInTheDocument()
  })

  it("saves the Merchant Center number, and sends only once it is there", async () => {
    fetchMock.mockResolvedValue(status({}))
    renderCard()
    expect(await screen.findByText("magaza@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Şimdi gönder" })).toBeDisabled()

    await userEvent.type(screen.getByLabelText("Merchant Center hesap numarası"), "123456789")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/merchant", {
        method: "POST",
        body: { merchant_id: "123456789" },
      })
    })
  })

  it("says how the return from Google went, once", async () => {
    window.history.replaceState(null, "", "/settings/marketing?google=denied")
    fetchMock.mockResolvedValue(status({ connected: false, email: null }))
    renderCard()

    await screen.findByRole("button", { name: "Google hesabını bağla" })
    expect(toastMock.error).toHaveBeenCalledTimes(1)
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/izin verilmedi/))
    expect(window.location.search).toBe("")
  })
})
