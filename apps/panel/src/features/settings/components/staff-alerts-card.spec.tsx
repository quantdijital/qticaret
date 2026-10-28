import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StaffAlertsCard } from "./staff-alerts-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const values = {
  staff_emails: ["sahip@magaza.example"],
  alert_new_order: true,
  alert_bank_transfer: true,
  alert_low_stock: true,
  alert_seo_digest: true,
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StaffAlertsCard />
    </QueryClientProvider>
  )
}

describe("StaffAlertsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ section: "notifications", values })
  })

  it("saves the addresses as a list and only the switches changed", async () => {
    renderCard()
    const box = await screen.findByLabelText("Uyarı alacak e-postalar")
    await userEvent.type(box, "\ndepo@magaza.example, ")
    await userEvent.click(screen.getByRole("switch", { name: "Haftalık SEO özeti" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/notifications",
        expect.objectContaining({
          method: "POST",
          body: {
            staff_emails: ["sahip@magaza.example", "depo@magaza.example"],
            alert_seo_digest: false,
          },
        })
      )
    })
  })
})
