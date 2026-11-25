import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Toaster } from "@qticaret/admin-ui/patterns/toaster"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { AiWallet } from "@/features/ai-credits/api/schemas"
import { AiCreditsTab } from "@/features/ai-credits/components/ai-credits-tab"
import { AiSettingsPage } from "@/features/ai-credits/pages/ai-settings-page"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { PROVIDERS, SETTINGS } from "@/test/ai-settings"
import { renderAs } from "@/test/member"
import { SHOP } from "@/test/shops"

// Plainly fake, short: never a real key's shape
const FAKE_KEY = "fake-key-456"
const BASE = `/admin/cp/tenants/${SHOP.tenant.id}/ai-credits`
const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

const WALLET: AiWallet = {
  balance: {
    plan: { balance: 120, period: "2026-11", renewsOn: "2026-12-01" },
    purchased: { balance: 1500, expiresAt: "2027-11-20T21:00:00.000Z" },
    daily: { cap: 300, spent: 45, remaining: 255 },
  },
  own_daily_cap: null,
  entries: [],
  count: 0,
  limit: 20,
  offset: 0,
}

const ON = {
  ...SHOP,
  tenant: { ...SHOP.tenant, status: "active" as const },
  features: [{ key: "ai.platform_credits", default: false, value: true }],
}

/** The control plane: a write without a proof is refused 428 (route table `stepUp: true`). */
function controlPlane(call: Sent): Answer {
  if (call.path === "/admin/cp/me/step-up") {
    return { status: 200, body: PROOF }
  }
  const proven = Boolean(call.headers[STEP_UP_HEADER])
  if (call.path === `${BASE}/adjust`) {
    return proven ? { status: 200, body: { applied: true } } : refusal(428, "cp.step_up_required")
  }
  if (call.path === "/admin/cp/ai/providers/deepseek" && call.method === "POST") {
    return proven
      ? { status: 200, body: { provider: { service: "deepseek", has_key: true } } }
      : refusal(428, "cp.step_up_required")
  }
  if (call.path.startsWith(`${BASE}?`)) {
    return { status: 200, body: WALLET }
  }
  if (call.path === "/admin/cp/ai/settings") {
    return { status: 200, body: SETTINGS }
  }
  if (call.path === "/admin/cp/ai/providers") {
    return { status: 200, body: PROVIDERS }
  }
  return { status: 200, body: {} }
}

const withHosts = (ui: ReactElement) =>
  renderAs(
    <>
      {ui}
      <StepUpHost />
      <Toaster />
    </>,
    "owner"
  )

async function proveWithCode() {
  await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

describe("the AI credits' writes behind a step-up (adr/0085 §5)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks for the code before a credit correction, then sends it once with the proof", async () => {
    const sent = stubApi(controlPlane)
    withHosts(<AiCreditsTab shop={ON} />)

    await userEvent.click(await screen.findByRole("button", { name: "Kredi ekle / düş" }))
    const form = await screen.findByRole("dialog", { name: "Kredi ekle / düş" })
    await userEvent.type(within(form).getByLabelText("Kredi miktarı"), "250")
    await userEvent.type(within(form).getByLabelText("Not"), "Kampanya telafisi")
    await userEvent.click(within(form).getByRole("button", { name: "Kredi ekle" }))
    await proveWithCode()

    expect(await screen.findByText("Kredi düzeltmesi yazıldı.")).toBeInTheDocument()
    const tries = sent.filter((call) => call.path === `${BASE}/adjust`)
    // The first one without a proof (428), then exactly one with it, the same key both times
    expect(tries.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
    expect(tries[1]?.body).toEqual(tries[0]?.body)
  })

  it("asks for the code before writing a key, sends it once with the proof, keeps it nowhere", async () => {
    const sent = stubApi(controlPlane)
    withHosts(<AiSettingsPage />)

    const replace = (await screen.findAllByRole("button", { name: "Anahtarı değiştir" })).at(0)
    if (!replace) {
      throw new Error("no replace button")
    }
    await userEvent.click(replace)
    const form = await screen.findByRole("dialog", { name: "DeepSeek anahtarı" })
    await userEvent.type(within(form).getByLabelText("API anahtarı"), FAKE_KEY)
    await userEvent.click(within(form).getByRole("button", { name: "Anahtarı kaydet" }))
    await proveWithCode()

    expect(await screen.findByText("Anahtar kaydedildi.")).toBeInTheDocument()
    await waitFor(() => {
      const written = sent.filter(
        (call) => call.method === "POST" && call.path === "/admin/cp/ai/providers/deepseek"
      )
      expect(written.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
      expect(written.map((call) => call.body)).toEqual([
        { api_key: FAKE_KEY },
        { api_key: FAKE_KEY },
      ])
    })
    expect(document.body.innerHTML).not.toContain(FAKE_KEY)
  })
})
