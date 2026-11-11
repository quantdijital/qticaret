import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { LIST, PRO, START } from "@/test/shops"
import { stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { TenantsPage } from "./tenants-page"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

function controlPlane(call: Sent): Answer {
  if (call.path.startsWith("/admin/cp/tenants") && call.method === "GET") {
    return { status: 200, body: LIST }
  }
  if (call.path === "/admin/cp/plans") {
    return { status: 200, body: { plans: [PRO, START] } }
  }
  if (call.path === "/admin/cp/tenants" && call.method === "POST") {
    return { status: 200, body: { tenant: { id: "ten_new", slug: "bicak-atolyesi" } } }
  }
  return { status: 404, body: {} }
}

describe("TenantsPage: the shops (adr/0061 §2, C7)", () => {
  beforeEach(() => {
    routerState.search = { status: "all", q: "", page: 1 }
    routerState.navigate.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists the shops with status, package and address, the tabs counted", async () => {
    const sent = stubApi(controlPlane)
    renderAs(<TenantsPage />, "readonly")

    await screen.findByText("My L'arte")
    const table = screen.getByRole("table")
    expect(within(table).getByText("mylarte.localhost")).toBeInTheDocument()
    expect(within(table).getByText("Profesyonel")).toBeInTheDocument()
    expect(within(table).getByText("Paket yok")).toBeInTheDocument()
    expect(within(table).getByText("Kuruluyor")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Tümü/ })).toHaveTextContent("2")
    expect(sent[0]?.path).toBe("/admin/cp/tenants?limit=20&offset=0")
    // A reading role is offered no new shop
    expect(screen.queryByRole("button", { name: "Yeni mağaza" })).not.toBeInTheDocument()
  })

  it("narrows by status and search in the address, back to the first page", async () => {
    stubApi(controlPlane)
    routerState.search = { status: "active", q: "larte", page: 3 }
    renderAs(<TenantsPage />, "operator")
    await screen.findByText("My L'arte")

    await userEvent.click(screen.getByRole("tab", { name: /Kuruluyor/ }))

    const move = routerState.navigate.mock.calls[0]?.[0] as {
      search: (prev: Record<string, unknown>) => Record<string, unknown>
    }
    expect(move.search({ status: "active", q: "larte", page: 3 })).toEqual({
      status: "provisioning",
      q: "larte",
      page: 1,
    })
  })

  it("opens a shop's page from its row", async () => {
    stubApi(controlPlane)
    renderAs(<TenantsPage />, "finance")

    await userEvent.click(await screen.findByText("Kahve Durağı"))

    expect(screen.getByText("Kahve Durağı").closest("a")).toHaveAttribute(
      "href",
      "/tenants/ten_kahve"
    )
  })

  it("makes a record from a name, its address suggested, with a package, then opens it", async () => {
    const sent = stubApi(controlPlane)
    renderAs(<TenantsPage />, "operator")

    await userEvent.click(await screen.findByRole("button", { name: "Yeni mağaza" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni mağaza" })
    await userEvent.type(within(dialog).getByLabelText("Mağaza adı"), "Bıçak Atölyesi")
    expect(within(dialog).getByLabelText("Platform adresi")).toHaveValue("bicak-atolyesi")
    await userEvent.click(await within(dialog).findByRole("radio", { name: /Profesyonel/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydı aç" }))

    await waitFor(() => {
      expect(routerState.navigate).toHaveBeenCalledWith({
        to: "/tenants/$id",
        params: { id: "ten_new" },
      })
    })
    expect(sent.find((call) => call.method === "POST")?.body).toEqual({
      name: "Bıçak Atölyesi",
      slug: "bicak-atolyesi",
      package_id: PRO.id,
    })
  })

  it("does not send an address the control plane would refuse", async () => {
    stubApi(controlPlane)
    renderAs(<TenantsPage />, "owner")

    await userEvent.click(await screen.findByRole("button", { name: "Yeni mağaza" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni mağaza" })
    await userEvent.type(within(dialog).getByLabelText("Mağaza adı"), "Kahve")
    await userEvent.clear(within(dialog).getByLabelText("Platform adresi"))
    await userEvent.type(within(dialog).getByLabelText("Platform adresi"), "1-kahve")

    expect(within(dialog).getByText(/harfle başlar/)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Kaydı aç" })).toBeDisabled()
  })
})
