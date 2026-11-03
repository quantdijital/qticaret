import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StaffRole } from "@/features/auth/api/staff"
import { clientWith } from "@/features/payment-links/payment-links.fixtures"
import { PaymentLinkSettingsCard } from "./payment-link-settings-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const STORED = { admin_max_discount_percent: 20, allow_cod: false }

function renderCard(role: StaffRole = "owner") {
  return render(
    <QueryClientProvider client={clientWith({ role })}>
      <PaymentLinkSettingsCard />
    </QueryClientProvider>
  )
}

const posts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

describe("the payment links' settings (adr/0051)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    fetchMock.mockImplementation((_path: string, init?: { body?: object }) =>
      Promise.resolve({
        section: "payment_links",
        values: { ...STORED, ...init?.body },
        version: 1,
      })
    )
  })

  it("lets the owner lower an admin's limit and allow cash on delivery, saving what changed", async () => {
    const user = userEvent.setup()
    renderCard()
    const limit = await screen.findByLabelText("Yöneticinin verebileceği en büyük indirim")
    expect(limit).toHaveValue("20")

    await user.clear(limit)
    await user.type(limit, "15")
    await user.click(screen.getByRole("switch", { name: /kapıda ödeme/ }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posts()).toEqual([
        [
          "/admin/platform-settings/payment_links",
          { method: "POST", body: { admin_max_discount_percent: 15, allow_cod: true } },
        ],
      ])
    })
    expect(toast.success).toHaveBeenCalledWith("Ödeme bağlantısı ayarları kaydedildi.")
  })

  it("refuses a limit outside 0–99 before asking", async () => {
    const user = userEvent.setup()
    renderCard()
    const limit = await screen.findByLabelText("Yöneticinin verebileceği en büyük indirim")

    await user.clear(limit)
    await user.type(limit, "100")

    expect(screen.getByText("0 ile 99 arasında bir tam sayı girin.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled()
  })

  it("shows an admin the settings without a way to change them", async () => {
    renderCard("admin")

    expect(await screen.findByLabelText("Yöneticinin verebileceği en büyük indirim")).toBeDisabled()
    expect(screen.getByRole("switch", { name: /kapıda ödeme/ })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull()
    expect(screen.getByText("Bu ayarları yalnız mağaza sahibi değiştirebilir.")).toBeInTheDocument()
  })
})
