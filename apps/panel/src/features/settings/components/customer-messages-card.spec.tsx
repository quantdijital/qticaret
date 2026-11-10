import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StaffRole } from "@/features/auth/api/staff"
import { clientWith } from "@/features/payment-links/payment-links.fixtures"
import { MESSAGES } from "@/features/settings/customer-messages.fixtures"
import { CustomerMessagesCard } from "./customer-messages-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
// The router's Link needs a router; the dialog's link is checked by its address
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const PREVIEW = {
  name: "order.delivered",
  kind: "transactional",
  email: { subject: "Teslim!", html: "<p>Merhaba Ayşe</p>", text: "Merhaba Ayşe" },
  sms: "Atölye: #1042 numaralı siparişiniz alındı.",
}

function renderCard(role: StaffRole = "owner") {
  return render(
    <QueryClientProvider client={clientWith({ role })}>
      <CustomerMessagesCard />
    </QueryClientProvider>
  )
}

const calls = (path: string, method?: string) =>
  fetchMock.mock.calls.filter(
    ([called, init]) =>
      called === path && (init as { method?: string } | undefined)?.method === method
  )

/** The card for `role`, the row's dialog opened. */
async function openRow(name: RegExp, role: StaffRole = "owner") {
  renderCard(role)
  await userEvent.click(await screen.findByRole("button", { name }))
  return screen.findByRole("dialog")
}

/** adr/0036 Ek 2026-11-10: Ayarlar > Bildirimler > Müşteri mesajları. */
describe("CustomerMessagesCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    fetchMock.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/admin/messaging/customer-messages") {
        return Promise.resolve({ messages: MESSAGES })
      }
      if (path.startsWith("/admin/messaging/customer-messages/") && init?.method === "POST") {
        return Promise.resolve({ customer_message: MESSAGES[1] })
      }
      return Promise.resolve(PREVIEW)
    })
  })

  it("lists the messages under their groups, with what is required, off or reworded", async () => {
    renderCard()

    const order = await screen.findByRole("region", { name: "Sipariş" })
    expect(within(order).getByText("Sipariş alındı")).toBeInTheDocument()
    expect(within(order).getByText("Zorunlu")).toBeInTheDocument()
    const shipping = screen.getByRole("region", { name: "Kargo" })
    expect(within(shipping).getByText("Özelleştirildi")).toBeInTheDocument()
    expect(within(shipping).getByText("Açık")).toBeInTheDocument()
    const marketing = screen.getByRole("region", { name: "Pazarlama" })
    expect(within(marketing).getByText("Kapalı")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "İade" })).not.toBeInTheDocument()
  })

  it("offers no switch on a required message, says why, and counts its SMS", async () => {
    const dialog = await openRow(/Sipariş alındı/)

    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument()
    expect(within(dialog).getByText(/6502 s. Kanun md. 48/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("tab", { name: "SMS" }))
    const sms = within(dialog).getByLabelText("SMS metni")
    expect(sms).toHaveValue(
      "{mağaza_adı}: #{sipariş_no} numaralı siparişiniz alındı. Toplam {toplam}."
    )
    expect(within(dialog).getByText(/1 SMS/)).toBeInTheDocument()

    await userEvent.clear(sms)
    await userEvent.type(sms, "ş".repeat(80))
    expect(within(dialog).getByText(/2 SMS olarak gönderilir/)).toBeInTheDocument()
  })

  it("puts a token where the caret is, names an unknown one and holds the save", async () => {
    const dialog = await openRow(/Sipariş teslim edildi/)
    const subject = within(dialog).getByLabelText("Konu")
    await userEvent.clear(subject)
    await userEvent.type(subject, "Teslim edildi ")

    // The subject is the first field: its menu is the first
    const [menu] = within(dialog).getAllByRole("button", { name: "Bilgi ekle" })
    await userEvent.click(menu ?? subject)
    await userEvent.click(await screen.findByRole("menuitem", { name: /Sipariş numarası/ }))
    expect(subject).toHaveValue("Teslim edildi {sipariş_no}")
    expect(screen.queryByRole("menuitem", { name: /Telefon/ })).not.toBeInTheDocument()

    await userEvent.type(subject, " {{takip_no}")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("{takip_no}")
    expect(within(dialog).getByRole("button", { name: "Kaydet" })).toBeDisabled()
  })

  it("turns an optional message off, puts the defaults back and saves what changed", async () => {
    const dialog = await openRow(/Sipariş teslim edildi/)

    await userEvent.click(within(dialog).getByRole("switch", { name: /Bu iletiyi gönder/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Varsayılana dön" }))
    expect(within(dialog).getByLabelText("Konu")).toHaveValue(
      "Siparişiniz teslim edildi (#{sipariş_no})"
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(calls("/admin/messaging/customer-messages/order.delivered", "POST")).toHaveLength(1)
    })
    expect(calls("/admin/messaging/customer-messages/order.delivered", "POST")[0]?.[1]).toEqual({
      method: "POST",
      body: { subject: null, enabled: false },
    })
    expect(toast.success).toHaveBeenCalledWith("Mesaj kaydedildi.")
  })

  it("previews the words as typed, without saving them", async () => {
    const dialog = await openRow(/Sipariş teslim edildi/)
    const intro = within(dialog).getByLabelText("Giriş metni")
    await userEvent.clear(intro)
    await userEvent.type(intro, "Merhaba {{müşteri_adı}")

    await waitFor(
      () => {
        expect(
          calls("/admin/messaging/templates/order.delivered/preview", "POST").some(
            ([, init]) =>
              (init as { body: { intro?: string } }).body.intro === "Merhaba {müşteri_adı}"
          )
        ).toBe(true)
      },
      { timeout: 2000 }
    )
    expect(calls("/admin/messaging/customer-messages/order.delivered", "POST")).toHaveLength(0)
    expect(
      within(dialog).getByTitle("Sipariş teslim edildi e-postasının önizlemesi")
    ).toHaveAttribute("sandbox", "")
  })

  it("sends the cart reminder's switch to Pazarlama", async () => {
    const dialog = await openRow(/Terk edilmiş sepet hatırlatması/)

    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: /Sepet hatırlatma ayarına git/ })
    ).toHaveAttribute("href", "/settings/marketing")
  })

  it("shows read-only staff the words and the saved preview, nothing to change", async () => {
    const dialog = await openRow(/Sipariş teslim edildi/, "operations")

    expect(within(dialog).getByLabelText("Konu")).toBeDisabled()
    expect(within(dialog).getByRole("switch")).toBeDisabled()
    expect(
      within(dialog).queryByRole("button", { name: "Varsayılana dön" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(calls("/admin/messaging/templates/order.delivered/preview", undefined)).toHaveLength(1)
    })
    expect(calls("/admin/messaging/templates/order.delivered/preview", "POST")).toHaveLength(0)
  })
})
