import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY, refreshStandingAfter } from "@/features/auth/api/staff"
import { PlanStatusBanner } from "./plan-status-banner"

const fetchMock = vi.hoisted(() => vi.fn<(url: string) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

/** `GET /admin/staff/me` for a role, with the shop's status (or none, an older backend). */
const me = (role: "owner" | "operations", status?: string) => ({
  user_id: "user_1",
  role,
  can: { settings: role === "owner" },
  mfa: { available: true, required: true, enabled: true, passed: true },
  ...(status ? { plan: { status } } : {}),
})

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <p>Sayfa</p>
      <PlanStatusBanner />
    </QueryClientProvider>
  )
  return client
}

const settled = async (client: QueryClient) => {
  await vi.waitFor(() => {
    expect(client.getQueryState(STAFF_KEY)?.status).toBe("success")
  })
}

describe("PlanStatusBanner (adr/0061 Ek C15)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("tells the owner the shop is restricted and links to the subscription", async () => {
    fetchMock.mockResolvedValue(me("owner", "restricted"))
    renderBanner()

    const strip = await screen.findByRole("status")
    expect(strip).toHaveTextContent(
      "Mağazanız kısıtlı: abonelik ödemesi gecikti. Panel salt okunur; siparişlerin işlemleri, stok, KVKK talepleri, dışa aktarma ve kendi hesabınız açık. Vitrin satışa devam ediyor."
    )
    expect(strip).toHaveClass("bg-warning-soft")
    expect(screen.getByRole("link", { name: "Aboneliği gör" })).toHaveAttribute(
      "href",
      "/settings/subscription"
    )
    expect(fetchMock).toHaveBeenCalledWith("/admin/staff/me")
  })

  it("tells every other role too, sending them to the owner instead", async () => {
    fetchMock.mockResolvedValue(me("operations", "suspended"))
    renderBanner()

    const strip = await screen.findByRole("status")
    expect(strip).toHaveTextContent("Mağazanız askıya alındı: vitrin ziyaretçilere kapalı")
    expect(strip).toHaveTextContent("Ayrıntılar için mağaza sahibine başvurun.")
    expect(strip).toHaveClass("bg-destructive-soft")
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("shows nothing for an active shop, an older backend or an unknown status", async () => {
    for (const answer of [me("owner", "active"), me("owner"), me("owner", "closing")]) {
      fetchMock.mockResolvedValue(answer)
      const client = renderBanner()
      await settled(client)
      expect(screen.queryByRole("status")).toBeNull()
    }
  })

  it("reads the status again after any refused write", () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")
    refreshStandingAfter(client, { status: 403, message: "Mağazanız kısıtlandı" })
    refreshStandingAfter(client, { status: 400, message: "Ad gerekli" })
    refreshStandingAfter(client, null)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: STAFF_KEY })
  })
})
