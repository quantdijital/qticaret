import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PaytrAccount } from "@/features/settings/api/payments"
import { PaymentsPage } from "./payments-page"

const fetchMock = vi.hoisted(() => vi.fn())
// The open tab, as the address holds it (`?part=`)
const search = vi.hoisted(() => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
// Links as plain anchors with their params filled in: the page is rendered without a router
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search.current,
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string
    params?: Record<string, string>
    children: ReactNode
  }) => (
    <a href={to.replace(/\$(\w+)/g, (_, name: string) => params?.[name] ?? "")} {...rest}>
      {children}
    </a>
  ),
}))

const paytr = (account: Partial<PaytrAccount>): PaytrAccount => ({
  provider: "paytr",
  state: "not_configured",
  settings: null,
  secrets: { merchant_key: false, merchant_salt: false },
  secrets_version: 0,
  verified_at: null,
  updated_at: null,
  ...account,
})

function renderPage(account: PaytrAccount) {
  // The accounts, and each settings section the page reads (bank transfer: off)
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/admin/platform-settings/")
        ? {
            values: {
              enabled: false,
              installments_enabled: true,
              max_installment: 0,
              card_provider: null,
            },
            version: 1,
          }
        : { key_configured: true, accounts: [account] }
    )
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PaymentsPage />
    </QueryClientProvider>
  )
}

function around(element: HTMLElement, selector: string): HTMLElement {
  const found = element.closest<HTMLElement>(selector)
  if (!found) throw new Error(`No ${selector} around "${element.textContent}"`)
  return found
}

const row = async (name: string) => around(await screen.findByText(name), "li")

describe("PaymentsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    search.current = {}
  })

  it("groups the methods in tabs: cards first, installments, the others, then payment links", async () => {
    const { unmount } = renderPage(paytr({}))
    const card = around(await screen.findByRole("heading", { name: "Kartla ödeme" }), "section")

    expect(
      screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])
    ).toEqual([
      ["Kartla ödeme", "true"],
      ["Taksit", "false"],
      ["Diğer ödeme yöntemleri", "false"],
      // adr/0051: an admin's discount limit and cash on delivery for a link's order
      ["Ödeme bağlantıları", "false"],
    ])
    expect(within(card).getByText("PayTR")).toBeInTheDocument()
    expect(within(card).getByText("iyzico")).toBeInTheDocument()
    unmount()

    search.current = { part: "other" }
    renderPage(paytr({}))
    const other = around(
      await screen.findByRole("heading", { name: "Diğer ödeme yöntemleri" }),
      "section"
    )
    expect(within(other).getByText("Havale / EFT")).toBeInTheDocument()
    expect(within(other).getByText("Kapıda ödeme")).toBeInTheDocument()
  })

  it("offers to connect iyzico on its own page", async () => {
    renderPage(paytr({}))

    expect(within(await row("iyzico")).getByRole("link", { name: "Bağla" })).toHaveAttribute(
      "href",
      "/settings/payments/iyzico"
    )
  })

  it("offers to connect PayTR while no account is stored", async () => {
    renderPage(paytr({}))
    const paytrRow = await row("PayTR")

    expect(within(paytrRow).getByText("Bağlı değil")).toBeInTheDocument()
    expect(within(paytrRow).getByRole("link", { name: "Bağla" })).toHaveAttribute(
      "href",
      "/settings/payments/paytr"
    )
  })

  it("shows a connected account's state and test mode, and opens it to manage", async () => {
    renderPage(
      paytr({
        state: "connected",
        settings: { merchant_id: "100001", test_mode: true },
        secrets: { merchant_key: true, merchant_salt: true },
      })
    )
    const paytrRow = await row("PayTR")

    expect(within(paytrRow).getByText("Bağlı")).toBeInTheDocument()
    expect(within(paytrRow).getByText("Test modu")).toBeInTheDocument()
    expect(within(paytrRow).getByRole("link", { name: "Yönet" })).toHaveAccessibleDescription(
      "PayTR"
    )
  })

  it("names the provider that refused the stored details", async () => {
    renderPage(paytr({ state: "rejected", settings: { merchant_id: "100001", test_mode: false } }))

    expect(within(await row("PayTR")).getByText("PayTR reddetti")).toBeInTheDocument()
  })

  it("opens bank transfer and cash on delivery on pages of their own", async () => {
    search.current = { part: "other" }
    renderPage(paytr({}))

    for (const [name, id] of [
      ["Havale / EFT", "bank_transfer"],
      ["Kapıda ödeme", "cash_on_delivery"],
    ] as const) {
      const method = await row(name)
      expect(within(method).getByRole("link", { name: "Yönet" })).toHaveAttribute(
        "href",
        `/settings/payments/${id}`
      )
    }
  })
})
