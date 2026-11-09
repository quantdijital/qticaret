import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AbandonedCartDetail } from "@/features/customers/api/abandoned-carts"
import { AbandonedCartDialog } from "./abandoned-cart-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
// The customer link needs no router here
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/customers">{children}</a>,
}))

const CART: AbandonedCartDetail = {
  id: "cart_1",
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  phone_masked: "+905*** *** ** 67",
  phone: "+905321234567",
  customer: null,
  lines: [{ title: "Şef bıçağı", variant: "20 cm", quantity: 2, thumbnail: null }],
  line_count: 1,
  total: 1250,
  currency_code: "try",
  updated_at: "2026-11-05T10:00:00Z",
  reminder: null,
  consent: { email: null, sms: null },
  actions: { email_block: "no_consent", whatsapp: null },
}

function renderDialog(cart: AbandonedCartDetail) {
  fetchMock.mockImplementation((path: string, init?: { method?: string }) =>
    Promise.resolve(init?.method === "POST" ? { outcome: "sent" } : { cart })
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AbandonedCartDialog
        cartId={cart.id}
        steps={{ index: 0, total: 1, onGo: () => undefined }}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  )
}

describe("AbandonedCartDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("keeps the e-mail reminder off without consent, saying why, and offers no WhatsApp", async () => {
    renderDialog(CART)

    expect(await screen.findByText("Şef bıçağı")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /E-posta ile hatırlat/ })).toBeDisabled()
    expect(screen.getByText(/yalnızca izin verenlere gider/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/abandoned-carts/cart_1")
  })

  it("reminds a consenting shopper and opens WhatsApp with a neutral text", async () => {
    const user = userEvent.setup()
    renderDialog({
      ...CART,
      consent: { email: "granted", sms: "granted" },
      actions: { email_block: null, whatsapp: "905321234567" },
    })

    const whatsapp = await screen.findByRole("link", { name: /WhatsApp/ })
    expect(whatsapp.getAttribute("href")).toBe(
      `https://wa.me/905321234567?text=${encodeURIComponent(
        "Merhaba Ayşe, sepetinizde bıraktığınız ürünlerle ilgili yardımcı olabileceğimiz bir konu var mı?"
      )}`
    )
    await user.click(screen.getByRole("button", { name: /E-posta ile hatırlat/ }))
    expect(fetchMock).toHaveBeenCalledWith("/admin/abandoned-carts/cart_1/remind", {
      method: "POST",
      body: {},
    })
  })
})
