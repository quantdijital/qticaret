import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AbandonedCartCard } from "./abandoned-cart-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AbandonedCartCard />
    </QueryClientProvider>
  )
}

describe("AbandonedCartCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/cart-reminders/summary"
          ? { summary: { sent: 1240, returned: 310, ordered: 96 } }
          : {
              section: "marketing",
              values: { abandoned_cart_enabled: false, abandoned_cart_delay_minutes: 60 },
            }
      )
    )
  })

  it("turns the reminder on and saves only what changed", async () => {
    renderCard()
    const toggle = await screen.findByRole("switch", { name: "Hatırlatma gönder" })
    const save = screen.getByRole("button", { name: "Kaydet" })
    expect(save).toBeDisabled()

    await userEvent.click(toggle)
    await userEvent.click(save)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/marketing",
        expect.objectContaining({ method: "POST", body: { abandoned_cart_enabled: true } })
      )
    })
  })

  it("shows what the last 30 days' reminders did", async () => {
    renderCard()

    expect(await screen.findByText("1.240")).toBeInTheDocument()
    expect(screen.getByText("Sepete dönen")).toBeInTheDocument()
    expect(screen.getByText("96")).toBeInTheDocument()
  })
})
