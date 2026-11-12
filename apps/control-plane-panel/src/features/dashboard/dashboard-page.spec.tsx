import { screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { money } from "@/features/billing/words"
import type { Dashboard } from "@/features/dashboard/api"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { stubApi } from "@/test/api"
import { renderAs } from "@/test/member"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

/** The nearest ancestor matching `selector` (the test fails when there is none). */
function near(element: Element, selector: string): HTMLElement {
  const found = element.closest(selector)
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no ${selector} around the element`)
  }
  return found
}

const shop = (id: string, name: string) => ({ id, name, slug: id, status: "active" as const })

const BOARD: Dashboard = {
  today: "2026-11-12",
  shops: { active: 4, restricted: 1, suspended: 1, provisioning: 1, total: 7 },
  revenue: {
    mrr: 259_167,
    paying_count: 4,
    trial: { count: 1, mrr: 49_000 },
    currency_code: "TRY",
  },
  overdue: {
    count: 2,
    total: 1_240_000,
    oldest: [
      {
        tenant: shop("ten_celik", "Çelik Atölyesi"),
        charge_id: "chg_1",
        due_on: "2026-10-03",
        amount: 50_000,
      },
      {
        tenant: shop("ten_bicak", "Bıçakçı Ahmet"),
        charge_id: "chg_2",
        due_on: "2026-11-02",
        amount: 1_190_000,
      },
    ],
  },
  renewals: {
    days: 30,
    from: "2026-11-12",
    to: "2026-12-11",
    count: 3,
    total: 200_000,
    open: { count: 2, total: 80_000 },
    projected: { count: 1, total: 120_000 },
    next: [
      {
        tenant: shop("ten_gumus", "Gümüş Kalem"),
        charge_id: "chg_3",
        due_on: "2026-11-12",
        amount: 10_000,
        projected: false,
      },
      {
        tenant: shop("ten_mylarte", "My L'arte"),
        charge_id: null,
        due_on: "2026-12-02",
        amount: 120_000,
        projected: true,
      },
    ],
  },
  health: {
    unhealthy: 1,
    failing: 1,
    stale: 2,
    stale_after_hours: 3,
    drift: 2,
    shops: [
      {
        tenant: shop("ten_mylarte", "My L'arte"),
        problem: "unhealthy",
        target: "backend",
        since: new Date(Date.now() - 20 * 60_000).toISOString(),
        error: "health.http_503",
      },
      {
        tenant: shop("ten_ege", "Ege Seramik"),
        problem: "stale",
        target: null,
        since: new Date(Date.now() - 5 * 3_600_000).toISOString(),
        error: null,
      },
    ],
  },
}

const EMPTY: Dashboard = {
  ...BOARD,
  shops: { active: 0, restricted: 0, suspended: 0, provisioning: 0, total: 0 },
  revenue: { mrr: 0, paying_count: 0, trial: { count: 0, mrr: 0 }, currency_code: "TRY" },
  overdue: { count: 0, total: 0, oldest: [] },
  renewals: { ...BOARD.renewals, count: 0, total: 0, next: [] },
  health: { ...BOARD.health, unhealthy: 0, failing: 0, stale: 0, drift: 0, shops: [] },
}

const tile = (name: string) =>
  near(
    within(screen.getByRole("region", { name: "Platform özeti" })).getByText(name),
    "div.flex-col"
  )

describe("the dashboard (adr/0061 C18)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the five headline numbers, money as the billing screens write it", async () => {
    const sent = stubApi(() => ({ status: 200, body: BOARD }))
    renderAs(<DashboardPage />, "readonly")

    expect(await screen.findByText(money(259_167))).toBeInTheDocument()
    expect(sent.map((call) => call.path)).toEqual(["/admin/cp/dashboard"])
    expect(within(tile("Etkin mağaza")).getByText("4")).toBeInTheDocument()
    expect(
      within(tile("Etkin mağaza")).getByText("Toplam 7 · 1 kısıtlı · 1 askıda")
    ).toBeInTheDocument()
    expect(
      within(tile("Aylık tekrarlayan gelir")).getByText(
        `4 ödeyen abonelik · 1 denemede (+${money(49_000)})`
      )
    ).toBeInTheDocument()
    expect(within(tile("Geciken ödeme")).getByText(money(1_240_000))).toBeInTheDocument()
    expect(within(tile("Geciken ödeme")).getByText("2 kayıt")).toBeInTheDocument()
    expect(within(tile("Yaklaşan yenileme")).getByText(money(200_000))).toBeInTheDocument()
    expect(within(tile("Yaklaşan yenileme")).getByText("30 günde 3 ödeme")).toBeInTheDocument()
    expect(
      within(tile("Sağlıksız mağaza")).getByText("1 yanıt vermiyor · 2 rapor göndermiyor")
    ).toBeInTheDocument()
  })

  it("lists the oldest overdue payments, the next renewals and the shops needing attention, each leading to its page", async () => {
    stubApi(() => ({ status: 200, body: BOARD }))
    renderAs(<DashboardPage />, "finance")

    const overdue = near(
      await screen.findByRole("heading", { name: "Geciken ödemeler" }),
      "section"
    )
    const celik = within(overdue).getByRole("link", { name: "Çelik Atölyesi" })
    expect(celik).toHaveAttribute("href", "/tenants/ten_celik")
    expect(within(overdue).getByText(money(1_190_000))).toBeInTheDocument()
    expect(within(overdue).getByRole("link", { name: "Tümünü gör" })).toHaveAttribute(
      "href",
      "/payments"
    )

    const renewals = near(screen.getByRole("heading", { name: "Yaklaşan yenilemeler" }), "section")
    expect(within(renewals).getByText("Kaydı açılacak")).toBeInTheDocument()
    expect(within(renewals).getAllByRole("listitem")).toHaveLength(2)

    const attention = near(
      screen.getByRole("heading", { name: "Dikkat isteyen mağazalar" }),
      "section"
    )
    expect(within(attention).getByText("Sağlıksız")).toBeInTheDocument()
    expect(within(attention).getByText("Rapor gelmiyor")).toBeInTheDocument()
    expect(within(attention).getByText(/^Arka uç · /)).toBeInTheDocument()
    expect(within(attention).getByText("2 mağaza hedef sürümünde değil.")).toBeInTheDocument()
    expect(within(attention).getByRole("link", { name: "Sürümlere git" })).toHaveAttribute(
      "href",
      "/releases"
    )
  })

  it("says so in a sentence when a list is empty, and shows no drift line", async () => {
    stubApi(() => ({ status: 200, body: EMPTY }))
    renderAs(<DashboardPage />, "operator")

    expect(await screen.findByText("Geciken ödeme yok.")).toBeInTheDocument()
    expect(screen.getByText("Önümüzdeki 30 günde yenileme yok.")).toBeInTheDocument()
    expect(screen.getByText("Sağlıksız ya da rapor göndermeyen mağaza yok.")).toBeInTheDocument()
    expect(screen.queryByText(/hedef sürümünde değil/)).toBeNull()
    expect(screen.getAllByText(money(0)).length).toBeGreaterThanOrEqual(3)
  })
})
