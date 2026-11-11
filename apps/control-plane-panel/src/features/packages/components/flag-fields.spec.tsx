import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { PRO, START } from "@/test/shops"
import { PackagesPage } from "@/features/packages/pages/packages-page"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const FLAGS = [{ key: "test.platform_sample", default: true }]

function controlPlane(call: Sent): Answer {
  if (call.path === "/admin/cp/plans" && call.method === "GET") {
    return {
      status: 200,
      body: {
        plans: [START, { ...PRO, features: { "test.platform_sample": false } }],
        platform_flags: FLAGS,
      },
    }
  }
  return { status: 200, body: { plan: PRO } }
}

/** A package's platform flags in its dialog (adr/0061 Ek C9). */
describe("PackageDialog: platform flags (C9)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the package's value, the default where it sets none, and saves a change", async () => {
    const sent = stubApi(controlPlane)
    renderAs(<PackagesPage />, "finance")

    await userEvent.click(await screen.findByText("Profesyonel"))
    const dialog = await screen.findByRole("dialog", { name: "Profesyonel" })
    const flag = within(dialog).getByRole("checkbox", { name: /Örnek platform özelliği/ })
    expect(flag).not.toBeChecked()
    expect(within(dialog).getByText("Varsayılan: Açık")).toBeInTheDocument()

    await userEvent.click(flag)
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(sent.find((call) => call.path === "/admin/cp/plans/pkg_pro")?.body).toMatchObject({
        features: { "test.platform_sample": true },
      })
    })
  })

  it("starts a package on the defaults", async () => {
    stubApi(controlPlane)
    renderAs(<PackagesPage />, "finance")

    await userEvent.click(await screen.findByText("Başlangıç"))
    const dialog = await screen.findByRole("dialog", { name: "Başlangıç" })
    expect(within(dialog).getByRole("checkbox", { name: /Örnek platform özelliği/ })).toBeChecked()
  })
})
