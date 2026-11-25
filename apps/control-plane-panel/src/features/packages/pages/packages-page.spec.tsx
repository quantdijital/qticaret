import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { OLD, PRO, START } from "@/test/shops"
import { PackagesPage } from "./packages-page"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

function controlPlane(call: Sent): Answer {
  if (call.path === "/admin/cp/plans" && call.method === "GET") {
    return { status: 200, body: { plans: [START, PRO, OLD] } }
  }
  if (call.path.endsWith("/price") || call.path.endsWith("/terms")) {
    return call.headers[STEP_UP_HEADER]
      ? { status: 200, body: { plan: PRO } }
      : refusal(428, "cp.step_up_required")
  }
  if (call.path === "/admin/cp/me/step-up") {
    return { status: 200, body: PROOF }
  }
  // A new package sets a price: a step-up (C7 review M1)
  if (call.path === "/admin/cp/plans" && call.method === "POST" && !call.headers[STEP_UP_HEADER]) {
    return refusal(428, "cp.step_up_required")
  }
  return { status: 200, body: { plan: PRO } }
}

const page = (role: Parameters<typeof renderAs>[1]) =>
  renderAs(
    <>
      <PackagesPage />
      <StepUpHost />
    </>,
    role
  )

describe("PackagesPage: the packages (adr/0061 §2, C7)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists the packages on sale with price, limits and shops; archived ones apart", async () => {
    stubApi(controlPlane)
    page("readonly")

    const table = await screen.findByRole("table")
    expect(await within(table).findByText("Profesyonel")).toBeInTheDocument()
    expect(within(table).getByText(/1\.490,00 \/ ay/)).toBeInTheDocument()
    expect(within(table).queryByText("Esnaf")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yeni paket" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("tab", { name: /Arşivde/ }))
    expect(await screen.findByText("Esnaf")).toBeInTheDocument()
  })

  it("makes a package with every limit, in kuruş, a limit left unlimited", async () => {
    const sent = stubApi(controlPlane)
    page("finance")

    await userEvent.click(await screen.findByRole("button", { name: "Yeni paket" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni paket" })
    await userEvent.type(within(dialog).getByLabelText("Kod"), "kurumsal")
    await userEvent.type(within(dialog).getByLabelText("Ad"), "Kurumsal")
    await userEvent.type(within(dialog).getByLabelText("Fiyat"), "4990")
    await userEvent.click(within(dialog).getByRole("radio", { name: "Yıllık" }))
    for (const [label, value] of [
      ["Ürün", "50000"],
      ["Aylık sipariş", "100000"],
      ["Personel", "50"],
      ["Depolama", "102400"],
      ["Aylık içerik kredisi", "10000"],
    ] as const) {
      await userEvent.type(within(dialog).getByLabelText(new RegExp(`^${label}`)), value)
    }
    // The last limit, custom domains, without a limit
    const unlimited = within(dialog).getAllByRole("checkbox", { name: "Sınırsız" })
    // The monthly free AI credits are a number, never unlimited (adr/0085 K5); 0 to start
    expect(unlimited).toHaveLength(6)
    expect(within(dialog).getByLabelText(/^Aylık ücretsiz yapay zekâ kredisi/)).toHaveValue("0")
    const last = unlimited.at(-1)
    if (!last) {
      throw new Error("no limit row")
    }
    await userEvent.click(last)
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(
        sent.filter((call) => call.path === "/admin/cp/plans" && call.method === "POST").at(-1)
          ?.headers[STEP_UP_HEADER]
      ).toBe("proof-1")
    })
    await waitFor(() => {
      expect(sent.find((call) => call.method === "POST")?.body).toEqual({
        code: "kurumsal",
        name: "Kurumsal",
        price: 499_000,
        period: "yearly",
        trial_days: 14,
        grace_days: 7,
        limits: {
          products: 50000,
          orders_per_month: 100000,
          staff: 50,
          storage_mb: 102400,
          llm_credits_per_month: 10000,
          custom_domains: null,
          ai_free_credits_per_month: 0,
        },
      })
    })
  })

  it("asks the step-up for a new price only, after saving the rest", async () => {
    const sent = stubApi(controlPlane)
    page("owner")

    await userEvent.click(await screen.findByText("Profesyonel"))
    const dialog = await screen.findByRole("dialog", { name: "Profesyonel" })
    const price = within(dialog).getByLabelText("Fiyat")
    await userEvent.clear(price)
    await userEvent.type(price, "1690")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(
        sent.filter((call) => call.path.endsWith("/price")).at(-1)?.headers[STEP_UP_HEADER]
      ).toBe("proof-1")
    })
    expect(sent.find((call) => call.path === "/admin/cp/plans/pkg_pro")?.body).toMatchObject({
      name: "Profesyonel",
    })
    expect(sent.find((call) => call.path.endsWith("/price"))?.body).toEqual({
      price: 169_000,
      period: "monthly",
    })
  })

  it("asks the step-up for new trial and grace days, sent apart from the name (Ek C19 L1)", async () => {
    const sent = stubApi(controlPlane)
    page("finance")

    await userEvent.click(await screen.findByText("Profesyonel"))
    const dialog = await screen.findByRole("dialog", { name: "Profesyonel" })
    const grace = within(dialog).getByLabelText("Ek süre")
    await userEvent.clear(grace)
    await userEvent.type(grace, "30")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(
        sent.filter((call) => call.path.endsWith("/terms")).at(-1)?.headers[STEP_UP_HEADER]
      ).toBe("proof-1")
    })
    expect(sent.find((call) => call.path.endsWith("/terms"))?.body).toEqual({
      trial_days: 14,
      grace_days: 30,
    })
    const plain = sent.find((call) => call.path === "/admin/cp/plans/pkg_pro")?.body
    expect(plain).not.toHaveProperty("grace_days")
    expect(plain).not.toHaveProperty("trial_days")
    expect(sent.some((call) => call.path.endsWith("/price"))).toBe(false)
  })

  it("says how many shops keep an archived package before archiving it", async () => {
    const sent = stubApi(controlPlane)
    page("finance")

    await userEvent.click(await screen.findByText("Profesyonel"))
    await userEvent.click(await screen.findByRole("button", { name: "Arşivle" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm).toHaveTextContent("Bu paketi kullanan 2 mağaza paketini ve limitlerini korur.")
    await userEvent.click(within(confirm).getByRole("button", { name: "Arşivle" }))

    await waitFor(() => {
      expect(sent.some((call) => call.path === "/admin/cp/plans/pkg_pro/archive")).toBe(true)
    })
  })
})
