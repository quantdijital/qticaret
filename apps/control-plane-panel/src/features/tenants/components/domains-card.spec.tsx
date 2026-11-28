import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { Domain, TenantDetail } from "@/features/tenants/api"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { SHOP } from "@/test/shops"
import { DomainsCard } from "./domains-card"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

const BASE = "/admin/cp/tenants/ten_kahve"
const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}
const TOKEN = "0123456789abcdef0123456789abcdef"

const TXT = {
  name: "_qticaret-verify.www.kahveduragi.com.tr",
  value: `qticaret-verify=${TOKEN}`,
}

const own = (changes: Partial<Domain> = {}): Domain => ({
  id: "tendm_2",
  hostname: "www.kahveduragi.com.tr",
  kind: "custom",
  verification: "pending",
  verification_error: null,
  verified_at: null,
  last_checked_at: null,
  is_primary: false,
  dns: {
    txt: {
      name: "_qticaret-verify.www.kahveduragi.com.tr",
      value: `qticaret-verify=${TOKEN}`,
    },
    routing: null,
  },
  created_at: "2026-11-28T09:00:00.000Z",
  ...changes,
})

const shopWith = (domain: Domain): TenantDetail => ({
  ...SHOP,
  tenant: { ...SHOP.tenant, id: "ten_kahve" },
  domains: [...SHOP.domains, domain],
})

function controlPlane(check: Answer = { status: 200, body: {} }) {
  return (call: Sent): Answer => {
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (call.path === `${BASE}/domains` && call.method === "POST") {
      return { status: 200, body: { domain: { id: "tendm_9", hostname: "magaza.com.tr" } } }
    }
    if (call.path.endsWith("/check")) {
      return check
    }
    if (call.path.endsWith("/primary") || call.method === "DELETE") {
      return call.headers[STEP_UP_HEADER]
        ? { status: 200, body: {} }
        : refusal(428, "cp.step_up_required")
    }
    return { status: 200, body: {} }
  }
}

const card = (domain: Domain, role: "operator" | "readonly" = "operator") =>
  renderAs(
    <>
      <DomainsCard shop={shopWith(domain)} />
      <StepUpHost />
    </>,
    role
  )

async function open(host = "www.kahveduragi.com.tr") {
  await userEvent.click(screen.getByRole("button", { name: host }))
  return await screen.findByRole("dialog", { name: host })
}

describe("a shop's own domain and its DNS check (F16.7)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the TXT record to publish, says routing and SSL wait for the server", async () => {
    stubApi(controlPlane())
    card(own())

    const dialog = await open()
    expect(within(dialog).getByText("_qticaret-verify.www.kahveduragi.com.tr")).toBeVisible()
    expect(within(dialog).getByText(`qticaret-verify=${TOKEN}`)).toBeVisible()
    expect(within(dialog).getByText(/Yönlendirme kaydı sunucu kurulunca/)).toBeVisible()
    expect(within(dialog).getByText("Sunucu kurulunca verilecek")).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Birincil yap" })).toBeDisabled()
  })

  it("shows the CNAME to add once the target is known, and the last check's reason", async () => {
    stubApi(controlPlane())
    card(
      own({
        verification_error: "txt_mismatch",
        last_checked_at: "2026-11-28T10:00:00.000Z",
        dns: {
          txt: TXT,
          routing: {
            type: "CNAME",
            name: "www.kahveduragi.com.tr",
            values: ["edge.quantticaret.com"],
          },
        },
      })
    )

    const dialog = await open()
    expect(within(dialog).getByText("CNAME")).toBeVisible()
    expect(within(dialog).getByText("edge.quantticaret.com")).toBeVisible()
    expect(within(dialog).getByText(/değeri farklı/)).toBeVisible()
  })

  it("asks DNS on 'Doğrula' and says the result", async () => {
    const sent = stubApi(
      controlPlane({
        status: 200,
        body: { domain: { id: "tendm_2", verification: "verified", verification_error: null } },
      })
    )
    card(own())

    const dialog = await open()
    await userEvent.click(within(dialog).getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Alan adı doğrulandı.")
    })
    expect(sent.some((call) => call.path === `${BASE}/domains/tendm_2/check`)).toBe(true)
  })

  it("proves the member again before making a verified domain primary", async () => {
    const sent = stubApi(controlPlane())
    card(own({ verification: "active", dns: { txt: TXT, routing: null } }))

    const dialog = await open()
    expect(within(dialog).getByText("Etkin")).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Birincil yap" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    const prove = await screen.findByRole("dialog", { name: /Kimliğinizi/ })
    await userEvent.click(within(prove).getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      const primary = sent.filter((call) => call.path === `${BASE}/domains/tendm_2/primary`)
      expect(primary.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
    })
  })

  it("opens a domain just added, so its records are at hand", async () => {
    stubApi(controlPlane())
    card(own())

    await userEvent.click(screen.getByRole("button", { name: "Alan adı ekle" }))
    const add = await screen.findByRole("dialog", { name: "Alan adı ekle" })
    await userEvent.type(within(add).getByLabelText("Alan adı"), "Magaza.com.tr")
    await userEvent.click(within(add).getByRole("button", { name: "Ekle" }))

    expect(await screen.findByRole("dialog", { name: "magaza.com.tr" })).toBeVisible()
  })

  it("offers no change to a read-only member", async () => {
    stubApi(controlPlane())
    card(own(), "readonly")

    const dialog = await open()
    expect(within(dialog).queryByRole("button", { name: "Doğrula" })).toBeNull()
    expect(within(dialog).queryByRole("button", { name: "Kaldır" })).toBeNull()
  })
})
