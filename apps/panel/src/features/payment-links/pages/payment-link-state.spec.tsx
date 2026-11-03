import { QueryClientProvider } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LinkShare, PaymentLink } from "@/features/payment-links/api/types"
import {
  around,
  clientWith,
  inDays,
  link,
  share,
} from "@/features/payment-links/payment-links.fixtures"
import { PaymentLinkPage } from "./payment-link-page"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const search = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search: query,
    className,
  }: {
    children: ReactNode
    to: string
    search?: Record<string, string>
    className?: string
  }) => (
    <a href={query ? `${to}?${new URLSearchParams(query).toString()}` : to} className={className}>
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useParams: () => ({ id: "plink_01" }),
    useSearch: () => search.current,
  }),
}))

type Init = { method?: string; body?: unknown } | undefined

function serve(
  answer: PaymentLink = link(),
  shared: LinkShare = share(),
  actions: Record<string, (init: Init) => Promise<unknown>> = {}
) {
  fetchMock.mockImplementation((url: string, init: Init) => {
    const action = Object.entries(actions).find(([path]) => url === path)
    if (action) {
      return action[1](init)
    }
    if (url === "/admin/payment-links/plink_01") {
      return Promise.resolve({ payment_link: answer })
    }
    if (url === "/admin/payment-links/plink_01/share") {
      return Promise.resolve({ share: shared })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderPage(client: QueryClient = clientWith()) {
  return render(
    <QueryClientProvider client={client}>
      <PaymentLinkPage />
    </QueryClientProvider>
  )
}

const card = (title: string) => within(around(screen.getByText(title), "section"))

describe("PaymentLinkPage: its end and its people (adr/0051 §12, §13)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
    search.current = {}
  })

  it("treats an open link past its end as expired, before the backend says so", async () => {
    // The share was read while it opened: its address must not be offered now
    serve(link({ status: "open", expires_at: inDays(-0.5) }), share())
    renderPage()

    expect(await screen.findByText("Süresi doldu")).toBeInTheDocument()
    expect(screen.queryByText("Açık")).toBeNull()
    const sharing = card("Paylaş")
    expect(
      await sharing.findByText(/Bağlantının süresi doldu; müşteri bununla artık ödeme yapamaz/)
    ).toBeInTheDocument()
    expect(sharing.queryByLabelText("Ödeme bağlantısı")).toBeNull()
    expect(sharing.queryByRole("link", { name: "WhatsApp'ta aç" })).toBeNull()
    expect(sharing.queryByRole("button", { name: "E-postayla gönder" })).toBeNull()
    const again = screen.getAllByRole("link", { name: /Yeniden oluştur/ })
    expect(again).toHaveLength(2)
    for (const each of again) {
      expect(each).toHaveAttribute("href", "/payment-links/new?from=plink_01")
    }
    expect(screen.queryByRole("button", { name: "Uzat" })).toBeNull()
    expect(screen.queryByRole("button", { name: "İptal et" })).toBeNull()
    expect(card("Ayrıntılar").queryByText(/uzatılabilir/)).toBeNull()
  })

  it("turns an open link to expired the moment it ends, the page left open", async () => {
    serve(link({ expires_at: new Date(Date.now() + 400).toISOString() }), share())
    renderPage()

    expect(await screen.findByRole("button", { name: "E-postayla gönder" })).toBeInTheDocument()
    expect(screen.getByText("Açık")).toBeInTheDocument()

    expect(
      await screen.findByText("Süresi doldu", undefined, { timeout: 3000 })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "E-postayla gönder" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Uzat" })).toBeNull()
  })

  it("names who made and who cancelled a link as the backend sends them", async () => {
    serve(
      link({
        status: "canceled",
        created_by: "user_9",
        created_by_name: "Selin Ak",
        canceled_by: "user_8",
        canceled_by_name: "Can Er",
        closed_at: "2026-11-03T10:00:00Z",
      }),
      share({ url: null, sms_text: null, whatsapp_url: null })
    )
    // The team list is not this role's to read: the names come from the link
    renderPage(clientWith({ role: "operations" }))

    await screen.findByText("Ayrıntılar")
    const facts = card("Ayrıntılar")
    expect(await facts.findByText(/^Selin Ak, /)).toBeInTheDocument()
    expect(facts.getByText(/^Can Er, /)).toBeInTheDocument()
    expect(facts.queryByText(/Ekip üyesi/)).toBeNull()
  })

  it("keeps today's names when the backend sends none", async () => {
    serve(link({ status: "canceled", canceled_by: "user_1", closed_at: "2026-11-03T10:00:00Z" }))
    renderPage()

    await screen.findByText("Ayrıntılar")
    const facts = card("Ayrıntılar")
    // The maker from the team list, the canceller oneself
    expect(await facts.findByText(/^Ece Demir, /)).toBeInTheDocument()
    expect(facts.getByText(/^Siz, /)).toBeInTheDocument()
  })
})
