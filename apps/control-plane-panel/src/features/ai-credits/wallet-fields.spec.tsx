import { screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiWallet } from "@/features/ai-credits/api/schemas"
import { AiCreditsTab } from "@/features/ai-credits/components/ai-credits-tab"
import { stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { WALLET, WALLET_PATH } from "@/test/ai-wallet"
import { renderAs } from "@/test/member"
import { SHOP } from "@/test/shops"

/** The control plane answering the tab's wallet read with `wallet`. */
const answering =
  (wallet: unknown) =>
  (call: Sent): Answer =>
    call.path.startsWith(`${WALLET_PATH}?`)
      ? { status: 200, body: wallet }
      : { status: 200, body: {} }

const OTHERS: AiWallet["entries"] = [
  {
    id: "ent_3",
    kind: "adjust",
    amount: -20,
    bucket: "plan",
    note: "Hatalı yükleme",
    actor: "user_other",
    actor_name: "Ayşe Yılmaz",
    created_at: "2026-11-22T10:00:00.000Z",
  },
  {
    id: "ent_4",
    kind: "adjust",
    amount: 10,
    bucket: "purchased",
    note: "Telafi",
    actor: "user_gone",
    actor_name: null,
    created_at: "2026-11-23T10:00:00.000Z",
  },
]

describe("the AI credits tab reads the wallet's own fields (P3d)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("names who wrote a ledger row, and says a removed member neutrally with the id beside", async () => {
    stubApi(answering({ ...WALLET, entries: [...WALLET.entries, ...OTHERS], count: 4 }))
    renderAs(<AiCreditsTab shop={SHOP} />, "owner")

    expect(await screen.findByText("Ayşe Yılmaz")).toBeInTheDocument()
    expect(screen.getByText("Deniz Kaya (siz)")).toBeInTheDocument()
    expect(screen.getByText("Sistem")).toBeInTheDocument()
    expect(screen.getByText("Silinmiş personel")).toBeInTheDocument()
    expect(screen.getByText("user_gone")).toBeInTheDocument()
    // A named member's id is not repeated
    expect(screen.queryByText("user_other")).toBeNull()
  })

  it("says a staff id unnamed by a control plane before P3d the same way", async () => {
    const entries = OTHERS.map((row) => ({ ...row, actor_name: undefined }))
    stubApi(answering({ ...WALLET, entries, count: 2 }))
    renderAs(<AiCreditsTab shop={SHOP} />, "owner")

    expect(await screen.findAllByText("Silinmiş personel")).toHaveLength(2)
    expect(screen.getByText("user_other")).toBeInTheDocument()
  })

  it("shows the month's grant left of its whole with a bar, and no off note", async () => {
    const sent = stubApi(answering(WALLET))
    renderAs(<AiCreditsTab shop={SHOP} />, "owner")

    expect(await screen.findByText("120 / 300")).toBeInTheDocument()
    const bar = screen.getByRole("progressbar", { name: "Aylık haktan kalan: %40" })
    expect(bar).toHaveAttribute("aria-valuenow", "40")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
    // SHOP's own flag is off and it is provisioning: the wallet's answer decides
    expect(screen.queryByText(/platform kredisi kapalı/)).toBeNull()
    // The tab reads the wallet alone, not the shop's detail or list
    expect(sent.filter((call) => call.path.startsWith("/admin/cp/tenants?"))).toEqual([])
  })

  it("draws no bar for a month without a grant", async () => {
    stubApi(answering({ ...WALLET, monthly_grant: 0 }))
    renderAs(<AiCreditsTab shop={SHOP} />, "owner")

    expect(await screen.findByText("120 / 0")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it("shows the remainder alone, no bar and no off note, from a control plane before P3d", async () => {
    // Sent as JSON: the undefined fields are left out of the answer
    stubApi(
      answering({
        ...WALLET,
        flag_on: undefined,
        tenant_status: undefined,
        monthly_grant: undefined,
      })
    )
    renderAs(<AiCreditsTab shop={SHOP} />, "owner")

    expect(await screen.findByText("120 kredi")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.queryByText(/platform kredisi kapalı/)).toBeNull()
  })

  it.each([
    ["its flag is off", { flag_on: false }],
    ["the shop is suspended", { tenant_status: "suspended" }],
  ])("says the credits are off when %s", async (_case, change) => {
    stubApi(answering({ ...WALLET, ...change }))
    renderAs(<AiCreditsTab shop={SHOP} />, "owner")

    expect(await screen.findByText(/Bu mağazada platform kredisi kapalı/)).toBeInTheDocument()
    // The wallet is still shown
    expect(screen.getByText("120 / 300")).toBeInTheDocument()
  })
})
