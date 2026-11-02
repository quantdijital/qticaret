import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { HealthReport, IntegrationView } from "@/features/settings/api/integrations"
import { IntegrationsPage } from "./integrations-page"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
// Links as plain anchors with their params filled in: the page is rendered without a router
vi.mock("@tanstack/react-router", () => ({
  linkOptions: (options: unknown) => options,
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

const view = (id: string, more: Partial<IntegrationView> = {}): IntegrationView => ({
  id,
  group: "payments",
  state: "not_set_up",
  notes: [],
  test: null,
  failures: [],
  ...more,
})

const OVERVIEW: IntegrationView[] = [
  view("paytr", {
    state: "attention",
    notes: [{ code: "rejected" }],
    test: "account",
    failures: [
      {
        at: "2026-10-30T06:12:00Z",
        code: "http_401",
        status: 401,
        method: "POST",
        path: "/odeme/api/get-token",
        request_id: "req_abc",
      },
      {
        at: "2026-10-30T05:00:00Z",
        code: "timeout",
        status: null,
        method: "POST",
        path: "/odeme/api/get-token",
        request_id: null,
      },
    ],
  }),
  view("bank_transfer", { state: "off" }),
  view("aras", { group: "shipping", state: "connected", test: "account" }),
  view("resend", { group: "messaging", state: "off", notes: [{ code: "not_sending" }] }),
]

const HEALTH: HealthReport = {
  status: "degraded",
  checked_at: new Date().toISOString(),
  checks: [
    { id: "paytr", kind: "payment", status: "down", reason: "auth_failed", latency_ms: 210 },
    { id: "aras", kind: "shipping", status: "ok", latency_ms: 120 },
  ],
}

function renderPage() {
  fetchMock.mockImplementation((path: string) => {
    if (path === "/admin/integrations/overview") {
      return Promise.resolve({ integrations: OVERVIEW })
    }
    if (path === "/admin/integrations/health") {
      return Promise.resolve(HEALTH)
    }
    return Promise.resolve({ check: "valid" })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <IntegrationsPage />
    </QueryClientProvider>
  )
}

const row = async (name: string) => {
  const found = (await screen.findByText(name)).closest<HTMLElement>("li")
  if (!found) throw new Error(`No row for ${name}`)
  return found
}

describe("IntegrationsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.clearAllMocks()
  })

  it("groups every service with where it stands, why, whether it answers and where it is set up", async () => {
    renderPage()

    const paytr = await row("PayTR")

    expect(screen.getByRole("heading", { name: "Ödeme" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Kargo" })).toBeInTheDocument()
    // Stored as needing attention, and not answering now: the live check decides the badge
    expect(within(paytr).getByText("Yanıt yok")).toBeInTheDocument()
    expect(
      within(paytr).getByText("Sağlayıcı kayıtlı bilgileri reddetti; hesabı yeniden kaydedin.")
    ).toBeInTheDocument()
    expect(
      within(paytr).getByText("Hesap bilgileri reddedildi; hesabı yeniden kaydedin.")
    ).toBeInTheDocument()
    expect(within(paytr).getByRole("link", { name: "Ayarla" })).toHaveAttribute(
      "href",
      "/settings/payments/paytr"
    )
    expect(within(await row("Aras Kargo")).getByText("120 ms")).toBeInTheDocument()
    expect(within(await row("Havale / EFT")).getByText("Kapalı")).toBeInTheDocument()
    // E-mail not set up yet is said in the shop's words, with where it is set up
    const email = await row("E-posta (Resend)")
    expect(
      within(email).getByText("E-posta gönderimi henüz kurulmadı; mağaza yayına alınırken açılır.")
    ).toBeInTheDocument()
    expect(within(email).getByRole("link", { name: "Ayarla" })).toHaveAttribute(
      "href",
      "/settings/notifications"
    )
    // Only the groups of services the shop uses
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(
      expect.not.arrayContaining(["Muhasebe", "Altyapı"])
    )
  })

  it("shows a provider's last failed call, and the ones before on request", async () => {
    const user = userEvent.setup()
    renderPage()
    const paytr = await row("PayTR")

    const last = within(paytr).getByRole("button", {
      name: /Son hata .*: Kimlik reddedildi \(401\)/,
    })
    expect(last).toHaveTextContent("son 2 hata")
    await user.click(last)

    expect(within(paytr).getByText("Zaman aşımı")).toBeInTheDocument()
    expect(
      within(paytr).getByText(/POST \/odeme\/api\/get-token · istek req_abc/)
    ).toBeInTheDocument()
  })

  it("tests a connection with the stored account and says how it went", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      within(await row("Aras Kargo")).getByRole("button", { name: "Bağlantıyı test et" })
    )

    expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/aras/check", {
      method: "POST",
      body: {},
    })
    expect(toast.success).toHaveBeenCalledWith("Aras Kargo bağlantısı çalışıyor.")
  })
})
