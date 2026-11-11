import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { PRO, START } from "@/test/shops"
import { NewTenantPage } from "./new-tenant-page"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

/** The control plane: `kalem` is taken; a step-up for the record and the setup. */
function controlPlane(refuse: Record<string, Answer> = {}) {
  return (call: Sent): Answer => {
    const path = call.path.split("?")[0] ?? ""
    const own = refuse[`${call.method} ${path}`]
    if (own) {
      return own
    }
    if (path === "/admin/cp/plans") {
      return { status: 200, body: { plans: [START, PRO], platform_flags: [] } }
    }
    if (path === "/admin/cp/tenant-availability") {
      const query = new URLSearchParams(call.path.split("?")[1] ?? "")
      const slug = query.get("slug")
      const hostname = query.get("hostname")
      return {
        status: 200,
        body: {
          platform_domain: "localhost",
          ...(slug
            ? {
                slug: {
                  value: slug,
                  hostname: `${slug}.localhost`,
                  problem: slug === "kalem" ? "cp.slug_taken" : null,
                },
              }
            : {}),
          ...(hostname ? { hostname: { value: hostname, problem: null } } : {}),
        },
      }
    }
    if (path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (path === "/admin/cp/tenants" || path === "/admin/cp/tenants/ten_new/provisioning") {
      if (!call.headers[STEP_UP_HEADER]) {
        return refusal(428, "cp.step_up_required")
      }
      return path === "/admin/cp/tenants"
        ? { status: 200, body: { tenant: { id: "ten_new", slug: "bicak-atolyesi" } } }
        : { status: 202, body: { run: { id: "prun_1", status: "running" } } }
    }
    return { status: 200, body: {} }
  }
}

const page = () =>
  renderAs(
    <>
      <NewTenantPage />
      <StepUpHost />
    </>,
    "operator"
  )

const next = () => userEvent.click(screen.getByRole("button", { name: /İleri/ }))

/** Through every step to the review, the address free. */
async function fillIn(domain = "") {
  await userEvent.type(screen.getByLabelText("Mağaza adı"), "Bıçak Atölyesi")
  await userEvent.type(screen.getByLabelText("Vergi kimlik no"), "1234567890")
  await next()
  await userEvent.type(screen.getByLabelText("Ad soyad"), "Ayşe Demir")
  await userEvent.type(screen.getByLabelText("E-posta"), "ayse@bicakatolyesi.com")
  await next()
  await userEvent.click(await screen.findByRole("radio", { name: /Profesyonel/ }))
  await next()
  if (domain) {
    await userEvent.type(screen.getByLabelText("Alan adı"), domain)
    await screen.findByText("Bu alan adı başka bir mağazada yok.")
  }
  await screen.findByText("Bu adres kullanılabilir.")
  await next()
  await next()
  await screen.findByRole("heading", { name: "Özet ve kur", level: 2 })
}

describe("NewTenantPage: the new shop wizard (C11)", () => {
  beforeEach(() => {
    routerState.navigate.mockReset()
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("says what is missing beside the field and keeps what was typed going back", async () => {
    stubApi(controlPlane())
    page()

    await next()
    expect(screen.getByText("Mağaza adını yazın.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Mağaza adı"), "Bıçak Atölyesi")
    await userEvent.type(screen.getByLabelText("Vergi kimlik no"), "1234567891")
    await next()
    expect(screen.getByLabelText("Vergi kimlik no")).toHaveAttribute("aria-invalid", "true")
    await userEvent.clear(screen.getByLabelText("Vergi kimlik no"))
    await next()

    await screen.findByRole("heading", { name: "Yetkililer", level: 2 })
    expect(screen.getByText(/sahip daveti bu e-posta adresine/)).toBeInTheDocument()
    await next()
    expect(screen.getByText("Ad soyadı yazın.")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Ad soyad"), "Ayşe Demir")
    await userEvent.click(screen.getByRole("button", { name: /Geri/ }))

    expect(screen.getByLabelText("Mağaza adı")).toHaveValue("Bıçak Atölyesi")
    await next()
    expect(screen.getByLabelText("Ad soyad")).toHaveValue("Ayşe Demir")
  })

  it("suggests the address from the name and says a taken one at once", async () => {
    stubApi(controlPlane())
    page()
    await userEvent.type(screen.getByLabelText("Mağaza adı"), "Bıçak Atölyesi")
    await next()
    await userEvent.type(screen.getByLabelText("Ad soyad"), "Ayşe Demir")
    await userEvent.type(screen.getByLabelText("E-posta"), "ayse@bicakatolyesi.com")
    await next()
    await next()
    expect(screen.getByText("Bir paket seçin.")).toBeInTheDocument()
    await userEvent.click(await screen.findByRole("radio", { name: /Profesyonel/ }))
    await next()

    expect(screen.getByLabelText("Platform adresi")).toHaveValue("bicak-atolyesi")
    expect(await screen.findByText("Bu adres kullanılabilir.")).toBeInTheDocument()
    expect(screen.getAllByText("bicak-atolyesi.localhost").length).toBeGreaterThan(0)
    await userEvent.clear(screen.getByLabelText("Platform adresi"))
    await userEvent.type(screen.getByLabelText("Platform adresi"), "kalem")

    expect(await screen.findByText("Bu platform adresi başka bir mağazanın.")).toBeInTheDocument()
    await next()
    expect(screen.getByRole("heading", { name: "Adres", level: 2 })).toBeInTheDocument()
  })

  it("makes the record, saves the rest, starts the setup with one proof, opens its tab", async () => {
    const sent = stubApi(controlPlane())
    page()
    await fillIn("bicakatolyesi.com")

    await userEvent.click(screen.getByRole("button", { name: "Kur" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(routerState.navigate).toHaveBeenCalledWith({
        to: "/tenants/$id",
        params: { id: "ten_new" },
        search: { part: "setup" },
        ignoreBlocker: true,
      })
    })
    const writes = sent.filter((call) => call.method === "POST")
    expect(writes.map((call) => call.path)).toEqual([
      "/admin/cp/tenants",
      "/admin/cp/me/step-up",
      "/admin/cp/tenants",
      "/admin/cp/tenants/ten_new/company",
      "/admin/cp/tenants/ten_new/contacts",
      "/admin/cp/tenants/ten_new/domains",
      "/admin/cp/tenants/ten_new/provisioning",
    ])
    // One proof for the record and the setup: the setup is not asked again
    expect(writes.at(-1)?.headers[STEP_UP_HEADER]).toBe("proof-1")
    expect(writes[2]?.body).toEqual({
      name: "Bıçak Atölyesi",
      slug: "bicak-atolyesi",
      package_id: PRO.id,
      sector_pack: "general",
    })
  })

  it("keeps the record when a save fails, does not start the setup and offers the way on", async () => {
    const sent = stubApi(
      controlPlane({
        "POST /admin/cp/tenants/ten_new/domains": refusal(
          422,
          "cp.domain_taken",
          "duplicate_error"
        ),
      })
    )
    page()
    await fillIn("bicakatolyesi.com")

    await userEvent.click(screen.getByRole("button", { name: "Kur" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    expect(
      await screen.findByText("Mağaza kaydedildi, bazı bilgiler kaydedilemedi")
    ).toBeInTheDocument()
    expect(screen.getByText("Bu alan adı başka bir mağazada kayıtlı.")).toBeInTheDocument()
    expect(sent.some((call) => call.path.endsWith("/provisioning"))).toBe(false)
    // Nothing before the review can change now: the record exists
    expect(screen.queryByRole("button", { name: /adımını düzenle$/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Mağaza sayfasına git" }))
    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: "ten_new" }, search: { part: "setup" } })
    )
  })
})
