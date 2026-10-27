import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { HealthReport } from "@/features/settings/api/integrations"
import { IntegrationsPage } from "./integrations-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
// Links as plain anchors with their params filled in: the page is rendered without a router
vi.mock("@tanstack/react-router", () => ({
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

function renderPage(report: HealthReport) {
  fetchMock.mockResolvedValue(report)
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
  })

  it("says which services answer, why one does not, and opens a provider's account", async () => {
    renderPage({
      status: "degraded",
      checked_at: new Date().toISOString(),
      checks: [
        { id: "redis", kind: "cache", status: "ok", latency_ms: 3 },
        { id: "paytr", kind: "payment", status: "down", reason: "auth_failed", latency_ms: 210 },
        { id: "iyzico", kind: "payment", status: "not_configured", latency_ms: 0 },
      ],
    })

    const redis = await row("Önbellek (Redis)")
    const paytr = await row("PayTR")
    const iyzico = await row("iyzico")

    expect(screen.getByText(/Yanıt vermeyen servis var/)).toBeInTheDocument()
    expect(within(redis).getByText("Çalışıyor")).toBeInTheDocument()
    expect(within(redis).queryByRole("link")).toBeNull()
    expect(within(paytr).getByText("Yanıt yok")).toBeInTheDocument()
    expect(within(paytr).getByText(/Hesap bilgileri reddedildi/)).toBeInTheDocument()
    expect(within(paytr).getByRole("link", { name: "Hesabı yönet" })).toHaveAttribute(
      "href",
      "/settings/payments/paytr"
    )
    expect(within(iyzico).getByText("Bağlı değil")).toBeInTheDocument()
    expect(within(iyzico).queryByText(/ms$/)).toBeNull()
  })

  it("names a service it does not know by its id, and an unknown reason plainly", async () => {
    renderPage({
      status: "degraded",
      checked_at: new Date().toISOString(),
      checks: [{ id: "s3", kind: "file_storage", status: "down", reason: "nope", latency_ms: 9 }],
    })

    const s3 = await row("s3")

    expect(within(s3).getByText("Kontrol sırasında hata oluştu.")).toBeInTheDocument()
  })
})
