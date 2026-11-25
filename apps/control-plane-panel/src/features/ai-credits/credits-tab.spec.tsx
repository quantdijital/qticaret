import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiWallet } from "@/features/ai-credits/api/schemas"
import { AiCreditsTab } from "@/features/ai-credits/components/ai-credits-tab"
import { forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { WALLET, WALLET_PATH } from "@/test/ai-wallet"
import { SHOP } from "@/test/shops"

const BASE = WALLET_PATH

function controlPlane(adjust: () => Answer) {
  return (call: Sent): Answer => {
    if (call.path.startsWith(`${BASE}?`) && call.method === "GET") {
      return { status: 200, body: WALLET }
    }
    if (call.path === `${BASE}/adjust`) {
      return adjust()
    }
    if (call.path === "/admin/cp/ai/settings") {
      return refusal(500, "boom")
    }
    return { status: 200, body: {} }
  }
}

const ON = {
  ...SHOP,
  tenant: { ...SHOP.tenant, status: "active" as const },
  features: [{ key: "ai.platform_credits", default: false, value: true }],
}

async function openAdjust() {
  await userEvent.click(await screen.findByRole("button", { name: "Kredi ekle / düş" }))
  return await screen.findByRole("dialog", { name: "Kredi ekle / düş" })
}

describe("a shop's AI credits tab (adr/0085 §5)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the wallet and the ledger, and no off note for an active shop with the flag", async () => {
    stubApi(controlPlane(() => ({ status: 200, body: { applied: true } })))
    renderAs(<AiCreditsTab shop={ON} />, "owner")

    expect(await screen.findByText("120 / 300")).toBeInTheDocument()
    expect(screen.getByText("1.500 kredi")).toBeInTheDocument()
    expect(screen.getByText("45 / 300")).toBeInTheDocument()
    expect(screen.getByText("Elle düzeltme")).toBeInTheDocument()
    expect(screen.getByText("+500")).toBeInTheDocument()
    expect(screen.getByText("−3")).toBeInTheDocument()
    expect(screen.getAllByText("Kampanya telafisi").length).toBeGreaterThan(0)
    expect(screen.getByText("Sistem")).toBeInTheDocument()
    expect(screen.queryByText(/platform kredisi kapalı/)).toBeNull()
  })

  it("does not send a correction without a note", async () => {
    const sent = stubApi(controlPlane(() => ({ status: 200, body: { applied: true } })))
    renderAs(<AiCreditsTab shop={ON} />, "owner")

    const form = await openAdjust()
    await userEvent.type(within(form).getByLabelText("Kredi miktarı"), "250")
    const submit = within(form).getByRole("button", { name: "Kredi ekle" })
    expect(submit).toBeDisabled()
    await userEvent.type(within(form).getByLabelText("Not"), "   ")
    expect(submit).toBeDisabled()
    await userEvent.click(submit)
    expect(sent.filter((call) => call.path === `${BASE}/adjust`)).toEqual([])
  })

  it.each<[string, () => never | Answer]>([
    ["a 5xx", () => refusal(500, "boom")],
    [
      "no answer",
      () => {
        throw new TypeError("Failed to fetch")
      },
    ],
  ])(
    "holds the form after a lost answer (%s) and sends the same request again",
    async (_case, lost) => {
      let answers = 0
      const sent = stubApi(
        controlPlane(() => {
          answers += 1
          return answers === 1 ? lost() : { status: 200, body: { applied: false } }
        })
      )
      renderAs(<AiCreditsTab shop={ON} />, "owner")

      const form = await openAdjust()
      await userEvent.click(within(form).getByLabelText("Kredi düş"))
      await userEvent.type(within(form).getByLabelText("Kredi miktarı"), "40")
      await userEvent.click(within(form).getByLabelText("Aylık hak"))
      await userEvent.type(within(form).getByLabelText("Not"), "Yanlış yükleme")
      await userEvent.click(within(form).getByRole("button", { name: "Kredi düş" }))
      expect(await within(form).findByRole("alert")).toHaveTextContent(
        "Önceki deneme kaydedilmiş olabilir. Yeniden denerseniz aynı işlem bir kez yazılır; farklı bir tutar için önce hesap dökümüne bakın."
      )
      // The amount, the way, the bucket and the note are held as they were sent
      expect(within(form).getByLabelText("Kredi miktarı")).toBeDisabled()
      expect(within(form).getByLabelText("Not")).toBeDisabled()
      expect(within(form).getByLabelText("Kredi ekle")).toBeDisabled()
      expect(within(form).getByLabelText("Satın alınan")).toBeDisabled()
      await userEvent.click(within(form).getByRole("button", { name: "Yeniden dene" }))

      await waitFor(() => {
        const tries = sent.filter((call) => call.path === `${BASE}/adjust`)
        expect(tries).toHaveLength(2)
        const [first, second] = tries.map((call) => call.body as Record<string, unknown>)
        expect(first).toEqual({
          amount: -40,
          bucket: "plan",
          note: "Yanlış yükleme",
          key: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        })
        expect(second).toEqual(first)
      })
    }
  )

  it("leaves the form open to change after a refusal (4xx)", async () => {
    const sent = stubApi(
      controlPlane(() => refusal(400, "cp.ai_credit_amount_invalid", "invalid_data"))
    )
    renderAs(<AiCreditsTab shop={ON} />, "owner")

    const form = await openAdjust()
    await userEvent.type(within(form).getByLabelText("Kredi miktarı"), "40")
    await userEvent.type(within(form).getByLabelText("Not"), "Telafi")
    await userEvent.click(within(form).getByRole("button", { name: "Kredi ekle" }))
    expect(await within(form).findByRole("alert")).toHaveTextContent("Kredi miktarı geçerli değil")
    const amount = within(form).getByLabelText("Kredi miktarı")
    expect(amount).toBeEnabled()
    expect(within(form).getByLabelText("Not")).toBeEnabled()
    await userEvent.clear(amount)
    await userEvent.type(amount, "30")
    await userEvent.click(within(form).getByRole("button", { name: "Kredi ekle" }))

    await waitFor(() => {
      const tries = sent.filter((call) => call.path === `${BASE}/adjust`)
      expect(tries.map((call) => (call.body as { amount: number }).amount)).toEqual([40, 30])
    })
  })

  it("never names the shop's own cap as the platform default when the settings are unread", async () => {
    const own: AiWallet = {
      ...WALLET,
      own_daily_cap: 150,
      balance: { ...WALLET.balance, daily: { cap: 150, spent: 0, remaining: 150 } },
    }
    const base = controlPlane(() => ({ status: 200, body: { applied: true } }))
    stubApi((call) => (call.path.startsWith(`${BASE}?`) ? { status: 200, body: own } : base(call)))
    renderAs(<AiCreditsTab shop={ON} />, "owner")

    await userEvent.click(await screen.findByRole("button", { name: "Günlük tavanı değiştir" }))
    const form = await screen.findByRole("dialog", { name: "Günlük tavanı değiştir" })
    expect(form).toHaveTextContent("Mağazanın bir günde harcayabileceği en çok kredi.")
    expect(form).not.toHaveTextContent("Genel varsayılan: 150")
    expect(within(form).getByLabelText("Bu mağazanın günlük tavanı")).toHaveAttribute(
      "placeholder",
      "genel varsayılan"
    )
  })
})
