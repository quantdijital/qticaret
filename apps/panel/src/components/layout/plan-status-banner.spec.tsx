import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { dayOf } from "@qticaret/admin-ui/lib/days"
import "@/lib/i18n"
import { STAFF_KEY, refreshStandingAfter } from "@/features/auth/api/staff"
import type { BillingSummary } from "@/features/settings/api/plan"
import { planOf } from "@/features/settings/plan.fixtures"
import { paymentStrip } from "@/features/settings/plan-rules"
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

  describe("the payment strip while the shop is active (Ek C16)", () => {
    const today = dayOf(new Date())
    const plusDays = (n: number) =>
      new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
    const answers = (role: "owner" | "operations", billing: BillingSummary) => (url: string) =>
      Promise.resolve(url === "/admin/plan" ? { plan: planOf({ billing }) } : me(role, "active"))
    const late: BillingSummary = {
      status: "past_due",
      due_on: plusDays(-3),
      grace_ends_on: plusDays(4),
      amount: 149_000,
      currency: "TRY",
    }

    it("tells the owner a payment is late, until when, and where to see how to pay", async () => {
      fetchMock.mockImplementation(answers("owner", late))
      renderBanner()

      const strip = await screen.findByRole("status")
      expect(strip).toHaveTextContent("Abonelik ödemeniz gecikti")
      expect(strip).toHaveTextContent("1.490,00")
      expect(strip).toHaveTextContent("tarihine kadar ödenmezse panel kısıtlanır")
      expect(strip).toHaveClass("bg-warning-soft")
      expect(screen.getByRole("link", { name: "Ödeme bilgileri" })).toHaveAttribute(
        "href",
        "/settings/subscription"
      )
    })

    it("reminds the owner in the last three days before the due day, not earlier", async () => {
      fetchMock.mockImplementation(
        answers("owner", { ...late, status: "active", due_on: plusDays(2), grace_ends_on: null })
      )
      renderBanner()
      expect(await screen.findByRole("status")).toHaveTextContent("Abonelik ödemenizin son günü")
    })

    it("shows nothing to other roles, nor far from the due day", async () => {
      fetchMock.mockImplementation(answers("operations", late))
      const client = renderBanner()
      await settled(client)
      expect(screen.queryByRole("status")).toBeNull()
      expect(fetchMock).not.toHaveBeenCalledWith("/admin/plan")

      cleanup()
      fetchMock.mockImplementation(
        answers("owner", { ...late, status: "active", due_on: plusDays(10), grace_ends_on: null })
      )
      const owner = renderBanner()
      await settled(owner)
      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/admin/plan")
      })
      expect(screen.queryByRole("status")).toBeNull()
    })

    it("names the strip by rule: late, soon or none", () => {
      expect(paymentStrip(late, today)).toBe("late")
      expect(paymentStrip({ ...late, status: "trialing", due_on: today }, today)).toBe("soon")
      expect(paymentStrip({ ...late, status: "active", due_on: plusDays(3) }, today)).toBe("soon")
      expect(paymentStrip({ ...late, status: "active", due_on: plusDays(4) }, today)).toBeNull()
      expect(paymentStrip({ ...late, status: "restricted" }, today)).toBeNull()
      expect(paymentStrip({ ...late, due_on: null }, today)).toBeNull()
      expect(paymentStrip(null, today)).toBeNull()
    })
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
