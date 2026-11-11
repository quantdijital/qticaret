import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { LIST, PRO, START } from "@/test/shops"
import { forgetStepUp } from "@/lib/step-up"
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
  return { status: 404, body: {} }
}

describe("TenantsPage: the shops (adr/0061 §2, C7)", () => {
  beforeEach(() => {
    routerState.search = { status: "all", q: "", page: 1 }
    routerState.navigate.mockReset()
    forgetStepUp()
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
    // Ek C13: the worse of its two standings in words; a dash when never probed
    expect(within(table).getByRole("columnheader", { name: "Sağlık" })).toBeInTheDocument()
    const rowOf = (name: string) =>
      within(table)
        .getAllByRole("row")
        .find((row) => row.textContent.includes(name)) ?? document.body
    expect(within(rowOf("My L'arte")).getByText("Yanıt vermiyor")).toBeInTheDocument()
    expect(within(rowOf("Kahve Durağı")).queryByText(/Sağlıklı|Yanıt/)).toBeNull()
    expect(screen.getByRole("tab", { name: /Tümü/ })).toHaveTextContent("2")
    expect(sent[0]?.path).toBe("/admin/cp/tenants?limit=20&offset=0")
    // A reading role is offered no new shop
    expect(screen.queryByRole("link", { name: "Yeni mağaza" })).not.toBeInTheDocument()
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

  it("offers the wizard as the single way to a new shop, to who may make one (C11)", async () => {
    stubApi(controlPlane)
    renderAs(<TenantsPage />, "operator")

    const link = await screen.findByRole("link", { name: "Yeni mağaza" })
    expect(link).toHaveAttribute("href", "/tenants/new")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
