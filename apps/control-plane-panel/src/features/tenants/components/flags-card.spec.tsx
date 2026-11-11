import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { PRO, SHOP, START } from "@/test/shops"
import type { TenantDetail } from "@/features/tenants/api"
import { TenantPage } from "@/features/tenants/pages/tenant-page"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const answer =
  (shop: TenantDetail) =>
  (call: Sent): Answer => {
    if (call.path === "/admin/cp/tenants/ten_kahve" && call.method === "GET") {
      return { status: 200, body: shop }
    }
    if (call.path === "/admin/cp/plans") {
      return { status: 200, body: { plans: [START, PRO], platform_flags: SHOP.platform_flags } }
    }
    return { status: 200, body: {} }
  }

/** The package tab's platform flags and plan document (adr/0061 Ek C9). */
describe("TenantPage: platform flags and the plan document (C9)", () => {
  beforeEach(() => {
    routerState.params = { id: "ten_kahve" }
    routerState.search = { part: "plan" }
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows each flag's package value and what applies, and the document's state", async () => {
    stubApi(answer(SHOP))
    renderAs(<TenantPage />, "operator")

    const row = (await screen.findByText("Örnek platform özelliği")).closest("tr")
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getAllByText("Kapalı")).toHaveLength(2)
    expect(screen.getByText("Plan belgesi")).toBeInTheDocument()
    expect(screen.getByText("Teslim edildi")).toBeInTheDocument()
    const serial = screen.getByText("Sıra no").nextElementSibling
    expect(serial?.textContent).toBe("3")
  })

  it("gives a flag an exception with its reason", async () => {
    const sent = stubApi(answer(SHOP))
    renderAs(<TenantPage />, "operator")

    await userEvent.click(await screen.findByText("Örnek platform özelliği"))
    const dialog = await screen.findByRole("dialog", { name: "Örnek platform özelliği" })
    expect(within(dialog).getByRole("checkbox", { name: "Açık" })).toBeChecked()
    await userEvent.type(within(dialog).getByLabelText("Gerekçe"), "Deneme için açıldı")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(sent.find((call) => call.path.endsWith("/feature-overrides"))?.body).toEqual({
        key: "test.platform_sample",
        enabled: true,
        reason: "Deneme için açıldı",
        expires_at: null,
      })
    })
  })

  it("lets a reading role look only, and shows it no document state", async () => {
    // The API leaves the document's state out for a reading role
    const readable: TenantDetail = { ...SHOP }
    delete readable.plan_document
    stubApi(answer(readable))
    renderAs(<TenantPage />, "readonly")

    await userEvent.click(await screen.findByText("Örnek platform özelliği"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByText("Plan belgesi")).toBeNull()
  })

  it("says so when no flag is in force", async () => {
    stubApi(answer({ ...SHOP, platform_flags: [], features: [] }))
    renderAs(<TenantPage />, "operator")

    expect(
      await screen.findByText("Bu sürümde paketlerin açıp kapattığı bir özellik yok.")
    ).toBeInTheDocument()
  })
})
