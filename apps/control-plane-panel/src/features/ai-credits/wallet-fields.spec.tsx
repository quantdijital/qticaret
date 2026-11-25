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
})
