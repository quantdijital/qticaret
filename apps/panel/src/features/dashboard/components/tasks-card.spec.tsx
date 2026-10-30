import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { DashboardTasks } from "@/features/dashboard/api/tasks"
import { TasksCard } from "./tasks-card"

const fetchMock = vi.hoisted(() => vi.fn())
const reach = vi.hoisted(() => ({ can: new Set<string>(["settings", "keys"]) }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => reach.can.has(capability),
}))
// A link as an anchor with its search in the address: rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
  }) => <a href={search ? `${to}?${new URLSearchParams(search).toString()}` : to}>{children}</a>,
}))

const tasks = (more: Partial<DashboardTasks> = {}): DashboardTasks => ({
  to_ship: 9,
  awaiting_payment: 2,
  low_stock: 1,
  low_stock_threshold: 5,
  draft_products: 0,
  orphan_payments: { refunding: 0, by_hand: 0 },
  accounting_stopped: null,
  webhooks_disabled: null,
  seo_setup_open: 0,
  legal_identity_missing: 0,
  capped: false,
  ...more,
})

function renderCard(answer: DashboardTasks) {
  fetchMock.mockResolvedValue(answer)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TasksCard />
    </QueryClientProvider>
  )
}

const hrefOf = async (label: string) =>
  (await screen.findByText(label)).closest("a")?.getAttribute("href")

describe("TasksCard", () => {
  beforeEach(() => {
    reach.can = new Set(["settings", "keys"])
  })

  it("opens each list already filtered to what waits", async () => {
    renderCard(tasks())

    expect(await hrefOf("Kargoya hazırlanacak")).toBe("/orders?stage=to_ship")
    expect(await hrefOf("Ödeme bekleyen")).toBe("/orders?stage=awaiting_payment")
    expect(await hrefOf("Stoku azalan")).toBe("/inventory?view=low")
    // Neither in use: no row for them
    expect(screen.queryByText("Aktarılamayan muhasebe kayıtları")).toBeNull()
    expect(screen.queryByText("Durdurulan webhook'lar")).toBeNull()
  })

  it("counts refused accounting records, turned-off hooks and SEO setup for those who can set them right", async () => {
    renderCard(
      tasks({
        accounting_stopped: 3,
        webhooks_disabled: 1,
        seo_setup_open: 2,
        legal_identity_missing: 1,
      })
    )

    expect(await hrefOf("Aktarılamayan muhasebe kayıtları")).toBe("/settings/accounting")
    expect(await hrefOf("Mağaza künyesi eksik")).toBe("/settings/store")
    expect(await hrefOf("Durdurulan webhook'lar")).toBe("/settings/api")
    expect(await hrefOf("SEO kurulumunda eksik")).toBe("/seo")
  })

  it("leaves them out for operations staff, who cannot act on them", async () => {
    reach.can = new Set(["orders", "stock"])
    renderCard(tasks({ accounting_stopped: 3, webhooks_disabled: 1, seo_setup_open: 2 }))

    await screen.findByText("Kargoya hazırlanacak")
    expect(screen.queryByText("Aktarılamayan muhasebe kayıtları")).toBeNull()
    expect(screen.queryByText("Durdurulan webhook'lar")).toBeNull()
    expect(screen.queryByText("SEO kurulumunda eksik")).toBeNull()
  })
})
