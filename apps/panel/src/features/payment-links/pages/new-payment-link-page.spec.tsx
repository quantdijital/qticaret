import { QueryClientProvider } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  VARIANT_A,
  around,
  clientWith,
  link,
  preview,
  refused,
  share,
} from "@/features/payment-links/payment-links.fixtures"
import { setReauthAsker } from "@/lib/reauth"
import { NewPaymentLinkPage } from "./new-payment-link-page"

const fetchMock = vi.hoisted(() => vi.fn())
const variants = vi.hoisted(() => vi.fn())
const customers = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { productVariant: { list: variants }, customer: { list: customers } },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => navigate,
  useBlocker: () => ({ status: "idle" }),
}))

type Init = { method?: string; body?: Record<string, unknown>; headers?: unknown } | undefined

/** The backend as these tests need it; `create` answers the making. */
function serve(create: (init: Init) => Promise<unknown>, answer = preview()) {
  fetchMock.mockImplementation((url: string, init: Init) => {
    if (url === "/admin/payment-links/preview") {
      return Promise.resolve({ preview: answer })
    }
    if (url === "/admin/payment-links" && init?.method === "POST") {
      return create(init)
    }
    if (url === "/admin/payment-links/plink_01") {
      return Promise.resolve({ payment_link: link() })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

const made = () => Promise.resolve({ payment_link: link({ id: "plink_new" }), share: share() })
const calls = (url: string) =>
  fetchMock.mock.calls.filter(([path]) => path === url).map(([, init]) => init as Init)

function renderPage(client: QueryClient = clientWith()) {
  return render(
    <QueryClientProvider client={client}>
      <NewPaymentLinkPage />
    </QueryClientProvider>
  )
}

async function addKnife(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Ürün ekle" }))
  await user.click(await screen.findByRole("option", { name: /Şef bıçağı/ }))
}

describe("NewPaymentLinkPage (adr/0051 §2, §13)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.current = {}
    variants.mockResolvedValue({
      variants: [
        { id: VARIANT_A, title: "20 cm", sku: "SEF-20", product: { title: "Şef bıçağı" } },
      ],
    })
    customers.mockResolvedValue({
      customers: [
        {
          id: "cus_01JC000000000000000000CCC",
          first_name: "Mehmet",
          last_name: "Kaya",
          email: "mehmet@example.com",
        },
      ],
    })
  })
  afterEach(() => {
    setReauthAsker(null)
  })

  it("prices a guest's order on the backend and makes it after the person proves themselves", async () => {
    const user = userEvent.setup()
    const asks: unknown[] = []
    setReauthAsker((ask) => {
      asks.push(ask)
      ask.answer({ method: "totp", secret: "123456" })
    })
    let tries = 0
    serve(() => (++tries === 1 ? Promise.reject(refused(428)) : made()))
    renderPage()

    await user.click(screen.getByRole("radio", { name: "Yeni müşteri" }))
    await user.type(screen.getByLabelText(/^Ad/), "Ayşe")
    await user.type(screen.getByLabelText(/^Soyad/), "Yılmaz")
    await user.type(screen.getByLabelText(/^E-posta/), "ayse@example.com")
    await user.type(screen.getByLabelText(/^Cep telefonu/), "0532 123 45 67")
    await addKnife(user)
    const quantity = screen.getByLabelText("Şef bıçağı · 20 cm · SEF-20 adedi")
    await user.clear(quantity)
    await user.type(quantity, "2")
    await user.click(screen.getByRole("tab", { name: "Süre ve not" }))
    await user.clear(screen.getByLabelText(/Geçerlilik/))
    await user.type(screen.getByLabelText(/Geçerlilik/), "24")

    // The summary is the backend's: what it priced, never worked out here
    const summary = within(around(screen.getByText("Özet"), "section"))
    expect((await summary.findByText("Toplam")).parentElement).toHaveTextContent("Toplam₺270,00")
    await waitFor(() => {
      expect(calls("/admin/payment-links/preview").at(-1)).toEqual({
        method: "POST",
        body: { lines: [{ variant_id: VARIANT_A, quantity: 2 }] },
      })
    })

    await user.click(screen.getByRole("button", { name: "Bağlantı oluştur" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/payment-links/$id",
        params: { id: "plink_new" },
        search: { created: true },
        ignoreBlocker: true,
      })
    })
    const body = {
      guest: {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        email: "ayse@example.com",
        phone: "0532 123 45 67",
      },
      lines: [{ variant_id: VARIANT_A, quantity: 2 }],
      expires_in_hours: 24,
    }
    expect(asks).toHaveLength(1)
    expect(calls("/admin/payment-links")).toEqual([
      { method: "POST", body },
      {
        method: "POST",
        body,
        headers: { "x-reauth-method": "totp", "x-reauth-secret": "123456" },
      },
    ])
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("unit_price")
  })

  it("makes one for a known customer with a discount and its reason", async () => {
    const user = userEvent.setup()
    serve(made)
    renderPage()

    await user.click(screen.getByRole("combobox", { name: /^Müşteri/ }))
    await user.click(await screen.findByRole("option", { name: /Mehmet Kaya/ }))
    await addKnife(user)
    await user.click(screen.getByRole("tab", { name: "İndirim" }))
    await user.click(screen.getByRole("switch", { name: "İndirim uygula" }))
    await user.type(screen.getByLabelText(/İndirim yüzdesi/), "10")
    await user.type(screen.getByLabelText(/^Neden/), "Sadık müşteri")
    await waitFor(() => {
      expect(calls("/admin/payment-links/preview").at(-1)?.body).toEqual({
        customer_id: "cus_01JC000000000000000000CCC",
        lines: [{ variant_id: VARIANT_A, quantity: 1 }],
        discount: { type: "percentage", value: 10, reason: "Sadık müşteri" },
      })
    })

    await user.click(screen.getByRole("button", { name: "Bağlantı oluştur" }))
    await waitFor(() => {
      expect(calls("/admin/payment-links")).toEqual([
        {
          method: "POST",
          body: {
            customer_id: "cus_01JC000000000000000000CCC",
            lines: [{ variant_id: VARIANT_A, quantity: 1 }],
            discount: { type: "percentage", value: 10, reason: "Sadık müşteri" },
            expires_in_hours: 72,
          },
        },
      ])
    })
  })

  it("offers no discount to the operations team", () => {
    serve(made)
    renderPage(clientWith({ role: "operations" }))

    expect(screen.getByRole("tab", { name: "Teslimat" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Süre ve not" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "İndirim" })).toBeNull()
  })

  it("marks the lines short on stock, as the backend says, and still makes the link", async () => {
    const user = userEvent.setup()
    serve(made, preview({ short_variant_ids: [VARIANT_A] }))
    renderPage()

    await addKnife(user)

    expect(await screen.findByText(/1 üründe stok yetersiz/)).toBeInTheDocument()
    expect(screen.getAllByText("Stok yetersiz")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Bağlantı oluştur" })).toBeEnabled()
  })

  it("shows a refusal in the backend's own words", async () => {
    const user = userEvent.setup()
    const words =
      "Bu indirim sınırınızı aşıyor (en çok %20). Daha fazlasını mağaza sahibi verebilir."
    serve(() => Promise.reject(refused(403, words)))
    renderPage()

    await user.click(screen.getByRole("radio", { name: "Yeni müşteri" }))
    await user.type(screen.getByLabelText(/^Ad/), "Ayşe")
    await user.type(screen.getByLabelText(/^Soyad/), "Yılmaz")
    await user.type(screen.getByLabelText(/^E-posta/), "ayse@example.com")
    await addKnife(user)
    await user.click(screen.getByRole("button", { name: "Bağlantı oluştur" }))

    expect(await screen.findByText(words)).toHaveAttribute("role", "alert")
    expect(navigate).not.toHaveBeenCalled()
  })

  it("says what is missing before asking the backend anything", async () => {
    const user = userEvent.setup()
    serve(made)
    renderPage()

    await user.click(screen.getByRole("button", { name: "Bağlantı oluştur" }))

    expect(await screen.findByText("Bir müşteri seçin.")).toBeInTheDocument()
    expect(screen.getByText("En az bir ürün ekleyin.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fills the form from a link to make again, its prices left to the preview", async () => {
    search.current = { from: "plink_01" }
    serve(made)
    renderPage()

    expect(await screen.findByLabelText(/^Ad/)).toHaveValue("Ayşe")
    expect(screen.getByLabelText(/^E-posta/)).toHaveValue("ayse.yilmaz@example.com")
    expect(screen.getByLabelText("Şef bıçağı · 20 cm adedi")).toHaveValue(2)
    await waitFor(() => {
      expect(calls("/admin/payment-links/preview").at(-1)?.body).toEqual({
        lines: [{ variant_id: VARIANT_A, quantity: 2 }],
      })
    })
  })

  it("says the feature is off instead of showing the form", () => {
    renderPage(clientWith({ flag: false }))

    expect(screen.getByText(/Ödeme bağlantıları bu mağazada kapalı/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Bağlantı oluştur" })).toBeNull()
  })
})
