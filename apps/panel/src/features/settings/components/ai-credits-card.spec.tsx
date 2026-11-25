import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AiCreditsCard } from "./ai-credits-card"
import { PACK, wallet } from "./ai-credits.fixtures"

const sdkFetch = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ role: "owner" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useStaff: () => staff }))

function renderCard(answer: unknown) {
  sdkFetch.mockResolvedValue(answer)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiCreditsCard />
    </QueryClientProvider>
  )
}

const card = () => screen.findByRole("heading", { name: "Platform kredisi" })
const topUp = () => screen.queryByRole("button", { name: "Kredi yükle" })

beforeEach(() => {
  sdkFetch.mockReset()
  staff.role = "owner"
})

describe("AiCreditsCard", () => {
  it("draws nothing at all while the credits are not available", async () => {
    const { container } = renderCard({ available: false })
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/credits")
    })
    // A beat for the answer: still nothing, no skeleton either
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/kredi/i)).toBeNull()
  })

  it("draws nothing and asks nothing for a role other than owner and admin", async () => {
    staff.role = "operations"
    const { container } = renderCard(wallet())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container).toBeEmptyDOMElement()
    expect(sdkFetch).not.toHaveBeenCalled()
  })

  it("says this month's grant and when it renews; the owner may top up", async () => {
    renderCard(wallet())
    await card()
    expect(screen.getByText("Bu ay 40 kredi kaldı")).toBeInTheDocument()
    expect(screen.getByText(/1 Ara 2026 tarihinde yenilenir/)).toBeInTheDocument()
    expect(topUp()).toBeInTheDocument()
    expect(screen.queryByText("Krediniz bitti.")).toBeNull()
  })

  it("says what is left of the month's whole grant, with a bar that repeats it (P5b)", async () => {
    renderCard(wallet({ plan: { remaining: 1500, renews_on: "2026-12-01", granted: 2000 } }))
    await card()
    expect(screen.getByText("Bu ay 1.500 / 2.000 kredi kaldı")).toBeInTheDocument()
    const bar = screen.getByRole("progressbar", { name: "Bu ayın kalan kredisi" })
    expect(bar).toHaveAttribute("aria-valuenow", "75")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
    expect(bar).toHaveAttribute("aria-valuetext", "2.000 krediden 1.500 kredi kaldı")
  })

  it("draws an empty bar beside the used-up words once the grant is spent", async () => {
    renderCard(wallet({ plan: { remaining: 0, renews_on: "2026-12-01", granted: 100 } }))
    await card()
    expect(screen.getByText(/Bu ayın kredisi bitti; 1 Ara 2026/)).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it.each([
    ["no whole", { remaining: 40, renews_on: "2026-12-01" }],
    ["a whole of 0", { remaining: 40, renews_on: "2026-12-01", granted: 0 }],
  ])("says the remainder alone and draws no bar with %s", async (_case, plan) => {
    renderCard(wallet({ plan }))
    await card()
    expect(screen.getByText("Bu ay 40 kredi kaldı")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it("says the grant used up and the topped-up credits with their last day", async () => {
    renderCard(
      wallet({
        plan: { remaining: 0, renews_on: "2026-12-01" },
        purchased: { remaining: 1200, expires_on: "2027-11-25" },
      })
    )
    await card()
    expect(screen.getByText(/Bu ayın kredisi bitti; 1 Ara 2026/)).toBeInTheDocument()
    expect(screen.getByText("Yüklenen kredi: 1.200")).toBeInTheDocument()
    expect(screen.getByText(/Son kullanma: 25 Kas 2027/)).toBeInTheDocument()
  })

  it("says both used up, with Kredi yükle as the card's main action", async () => {
    renderCard(wallet({ plan: { remaining: 0, renews_on: "2026-12-01" } }))
    await card()
    expect(screen.getByText("Krediniz bitti.")).toBeInTheDocument()
    expect(topUp()?.className).toMatch(/bg-primary/)
  })

  it("says the day's limit once reached", async () => {
    renderCard(wallet({ daily: { cap: 300, remaining: 0 } }))
    await card()
    expect(screen.getByText("Bugünkü sınıra ulaşıldı, yarın yenilenir.")).toBeInTheDocument()
  })

  it("says an open request with its pack and price, and hides Kredi yükle", async () => {
    renderCard(
      wallet({
        pending_order: {
          id: "aicord_01",
          pack_id: PACK.id,
          credits: 500,
          amount: 25_000,
          currency: "TRY",
          status: "pending",
          requested_at: "2026-11-25T10:00:00.000Z",
        },
      })
    )
    await card()
    expect(
      screen.getByText("Talebiniz alındı; ödeme onaylanınca krediniz yüklenir.")
    ).toBeInTheDocument()
    expect(screen.getByText(/500 kredi · ₺250,00/)).toBeInTheDocument()
    expect(topUp()).toBeNull()
  })

  it("says to write to us when no pack is offered", async () => {
    renderCard(wallet({ packs: [] }))
    await card()
    expect(screen.getByText("Kredi yüklemek için bize yazın.")).toBeInTheDocument()
    expect(topUp()).toBeNull()
  })

  it("shows an admin the wallet but never Kredi yükle", async () => {
    staff.role = "admin"
    renderCard(wallet({ plan: { remaining: 0, renews_on: "2026-12-01" } }))
    await card()
    expect(screen.getByText("Krediniz bitti.")).toBeInTheDocument()
    expect(topUp()).toBeNull()
    expect(screen.queryByText("Kredi yüklemek için bize yazın.")).toBeNull()
  })

  it("folds what each task costs, by the task's own name", async () => {
    renderCard(wallet())
    await card()
    const user = userEvent.setup()
    await user.click(screen.getByText("Bir işlem kaç kredi?"))
    const table = screen.getByRole("table")
    expect(within(table).getByRole("rowheader", { name: "Arama başlığı" })).toBeInTheDocument()
    expect(within(table).getByText("40 kredi")).toBeInTheDocument()
    expect(
      within(table).getByRole("rowheader", { name: "Sahneye yerleştirme" })
    ).toBeInTheDocument()
  })

  it("opens the top-up dialog from Kredi yükle", async () => {
    renderCard(wallet())
    await card()
    await userEvent.setup().click(screen.getByRole("button", { name: "Kredi yükle" }))
    expect(await screen.findByRole("dialog", { name: "Kredi yükle" })).toBeInTheDocument()
  })
})
