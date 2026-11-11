import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { PRO, SHOP, START } from "@/test/shops"
import type { TenantDetail } from "@/features/tenants/api"
import { TenantPage } from "./tenant-page"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const TCKN = "10000000146"
const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

function controlPlane(shop: TenantDetail) {
  return (call: Sent): Answer => {
    if (call.path === "/admin/cp/tenants/ten_kahve" && call.method === "GET") {
      return { status: 200, body: shop }
    }
    if (call.path === "/admin/cp/tenants/ten_kahve/reveal-tckn") {
      return call.headers[STEP_UP_HEADER]
        ? { status: 200, body: { tckn: TCKN } }
        : refusal(428, "cp.step_up_required")
    }
    if (call.path === "/admin/cp/tenants/ten_kahve/plan") {
      // The shop's package is what it pays: a step-up (C7 review M1)
      return call.headers[STEP_UP_HEADER]
        ? { status: 200, body: { package_id: "pkg_pro" } }
        : refusal(428, "cp.step_up_required")
    }
    if (call.path === "/admin/cp/plans") {
      return { status: 200, body: { plans: [START, PRO] } }
    }
    if (call.path === "/admin/cp/tenants/ten_kahve/provisioning" && call.method === "GET") {
      return { status: 200, body: { provisioner: "local", latest: null, runs: [] } }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (call.path.startsWith("/admin/cp/tenants/ten_kahve/activity")) {
      return {
        status: 200,
        body: {
          items: [
            {
              id: "cpaud_1",
              kind: "action",
              at: "2026-11-11T11:00:00.000Z",
              actor: "Deniz Kaya",
              action: "POST /admin/cp/tenants/:id/plan",
              changes: { package: { from: null, to: "baslangic" } },
            },
            {
              id: "tensc_1",
              kind: "status",
              at: "2026-11-11T09:00:00.000Z",
              actor: null,
              from_status: null,
              to_status: "provisioning",
              reason_code: "created",
            },
          ],
          next_before: null,
        },
      }
    }
    return { status: 200, body: {} }
  }
}

const page = (role: Parameters<typeof renderAs>[1], id?: string) =>
  renderAs(
    <>
      <TenantPage />
      <StepUpHost />
    </>,
    role,
    id
  )

describe("TenantPage: one shop (adr/0061 §2, C7)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.params = { id: "ten_kahve" }
    routerState.search = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the shop to a reading role, the TCKN masked, nothing to change", async () => {
    stubApi(controlPlane(SHOP))
    page("readonly")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Kahve Durağı" })
    ).toBeInTheDocument()
    expect(screen.getByText("*******0146")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Göster" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Düzenle" })).not.toBeInTheDocument()
    expect(screen.getByText("emre@kahveduragi.com")).toBeInTheDocument()
    expect(screen.getByText("+90 505 193 74 20")).toBeInTheDocument()
    // Nothing missing: no warning
    expect(screen.queryByText("Eksik bilgiler")).not.toBeInTheDocument()
  })

  it("shows the TCKN to finance after the step-up, never into the cache, and hides it again", async () => {
    const sent = stubApi(controlPlane(SHOP))
    const { client } = page("finance")

    await userEvent.click(await screen.findByRole("button", { name: "Göster" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    expect(await screen.findByText(TCKN)).toBeInTheDocument()
    const reveals = sent.filter((call) => call.path.endsWith("/reveal-tckn"))
    expect(reveals.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain(TCKN)
    await userEvent.click(screen.getByRole("button", { name: "Gizle" }))
    await waitFor(() => {
      expect(screen.queryByText(TCKN)).not.toBeInTheDocument()
    })
  })

  it("warns what the record lacks, saving it as it is", async () => {
    stubApi(
      controlPlane({
        ...SHOP,
        company: SHOP.company && {
          ...SHOP.company,
          kind: "company",
          tax_number: null,
          tckn_masked: null,
        },
        contacts: [],
        package: null,
      })
    )
    page("operator")

    const warning = await screen.findByRole("alert")
    expect(warning).toHaveTextContent("Fatura için firma bilgileri eksik: Vergi kimlik no.")
    expect(warning).toHaveTextContent("Faturalama kişisi yok")
    expect(warning).toHaveTextContent("Paket atanmadı")
  })

  it("shows the notes in their tab, writable by an operator, not by finance", async () => {
    routerState.search = { part: "notes" }
    const sent = stubApi(controlPlane(SHOP))
    page("operator")

    expect(await screen.findByText("Kurulum için Salı günü aranacak.")).toBeInTheDocument()
    expect(screen.getByText(/Ece Demir/)).toBeInTheDocument()
    // Another's note: an operator neither pins nor removes it
    expect(screen.queryByRole("button", { name: "Sabitlemeyi kaldır" })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Yeni not"), "Sözleşme imzalandı.")
    await userEvent.click(screen.getByRole("button", { name: "Not ekle" }))

    await waitFor(() => {
      expect(sent.find((call) => call.path.endsWith("/notes"))?.body).toEqual({
        body: "Sözleşme imzalandı.",
      })
    })
  })

  it("lets an operator change the company without retyping the TCKN", async () => {
    const sent = stubApi(controlPlane(SHOP))
    page("operator")

    await userEvent.click(await screen.findByRole("button", { name: "Düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Firma" })
    expect(within(dialog).getByLabelText("TC kimlik no")).toHaveAttribute(
      "placeholder",
      "Kayıtlı: *******0146 (değiştirmek için yazın)"
    )
    await userEvent.clear(within(dialog).getByLabelText("Posta kodu"))
    await userEvent.type(within(dialog).getByLabelText("Posta kodu"), "06100")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(sent.some((call) => call.path.endsWith("/company"))).toBe(true)
    })
    const company = sent.find((call) => call.path.endsWith("/company"))?.body as Record<
      string,
      unknown
    >
    expect(company).toMatchObject({ kind: "sole_proprietor", postal_code: "06100", tax_number: "" })
    expect(company).not.toHaveProperty("tckn")
  })

  it("gives a limit an exception with its reason from the package tab", async () => {
    routerState.search = { part: "plan" }
    const sent = stubApi(controlPlane(SHOP))
    page("operator")

    await userEvent.click(await screen.findByText("Personel"))
    const dialog = await screen.findByRole("dialog", { name: "Personel" })
    await userEvent.type(within(dialog).getByLabelText("Değer"), "5")
    await userEvent.type(within(dialog).getByLabelText("Gerekçe"), "Sezon için ek personel")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(sent.find((call) => call.path.endsWith("/overrides"))?.body).toEqual({
        key: "staff",
        value: 5,
        reason: "Sezon için ek personel",
        expires_at: null,
      })
    })
  })

  it("puts the shop on another package after the step-up", async () => {
    routerState.search = { part: "plan" }
    const sent = stubApi(controlPlane(SHOP))
    page("operator")

    await userEvent.click(await screen.findByRole("button", { name: "Paketi değiştir" }))
    const dialog = await screen.findByRole("dialog", { name: "Paket" })
    await userEvent.click(await within(dialog).findByRole("radio", { name: /Profesyonel/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      const assigned = sent.filter((call) => call.path.endsWith("/plan"))
      expect(assigned.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
      expect(assigned[1]?.body).toEqual({ package_id: PRO.id })
    })
  })

  it("reads the activity with who and what moved", async () => {
    routerState.search = { part: "activity" }
    stubApi(controlPlane(SHOP))
    page("readonly")

    expect(await screen.findByText("Paket değişti")).toBeInTheDocument()
    expect(screen.getByText(/Paket yok → baslangic/)).toBeInTheDocument()
    expect(screen.getByText("Kayıt açıldı")).toBeInTheDocument()
    expect(screen.getByText(/Sistem · yeni kayıt/)).toBeInTheDocument()
  })
})
