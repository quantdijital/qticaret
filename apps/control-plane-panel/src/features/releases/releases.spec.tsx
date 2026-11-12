import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { Release } from "@/features/releases/api"
import { VersionCard } from "@/features/releases/components/version-card"
import { ReleasesPage } from "@/features/releases/pages/releases-page"
import type { TenantDetail } from "@/features/tenants/api"
import { TenantsPage } from "@/features/tenants/pages/tenants-page"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { LIST, SHOP } from "@/test/shops"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

/** The nearest ancestor matching `selector` (the test fails when there is none). */
function near(element: Element, selector: string): HTMLElement {
  const found = element.closest(selector)
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no ${selector} around the element`)
  }
  return found
}

const COMMIT = "8a128bbe0c3d4e5f60718293a4b5c6d7e8f90a1b"
const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

const release = (changes: Partial<Release> = {}): Release => ({
  id: "rel_140",
  version: "1.4.0",
  commit: COMMIT,
  notes: "Kargo etiketinde ilçe düzeltmesi",
  created_by: "Deniz Kaya",
  created_at: "2026-11-10T09:00:00.000Z",
  reported_count: 3,
  target_count: 1,
  ...changes,
})

const RELEASES = [
  release(),
  release({
    id: "rel_150",
    version: "1.5.0",
    commit: "1234567abc",
    notes: null,
    reported_count: 0,
    target_count: 2,
  }),
]

/** The control plane: reads answered, changes behind the step-up. */
function controlPlane(answer: Answer | null = null) {
  return (call: Sent): Answer => {
    if (call.path === "/admin/cp/releases" && call.method === "GET") {
      return { status: 200, body: { releases: RELEASES } }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (call.method === "POST") {
      if (!call.headers[STEP_UP_HEADER]) {
        return refusal(428, "cp.step_up_required")
      }
      return answer ?? { status: 200, body: {} }
    }
    return { status: 200, body: {} }
  }
}

async function proveWithCode() {
  await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

const page = (role: Parameters<typeof renderAs>[1]) =>
  renderAs(
    <>
      <ReleasesPage />
      <StepUpHost />
    </>,
    role
  )

describe("Sürümler (adr/0061 F17.5, Ek C18)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.search = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists the releases with their commits, notes and counts; says a target is intent only", async () => {
    stubApi(controlPlane())
    page("readonly")

    const table = await screen.findByRole("table")
    expect(await within(table).findByText("8a128bbe0c3d")).toBeInTheDocument()
    expect(within(table).getByText("Kargo etiketinde ilçe düzeltmesi")).toBeInTheDocument()
    expect(within(table).getAllByRole("row")).toHaveLength(3)
    expect(
      screen.getByText(
        "Hedef sürüm yalnızca niyeti kaydeder; mağazalar şimdilik kendiliğinden güncellenmez."
      )
    ).toBeInTheDocument()
    // Reading only: no "Sürüm ekle", a row opens the release without an editor
    expect(screen.queryByRole("button", { name: "Sürüm ekle" })).toBeNull()
    await userEvent.click(within(table).getByRole("button", { name: "1.5.0" }))
    const dialog = await screen.findByRole("dialog", { name: "Sürüm 1.5.0" })
    expect(within(dialog).getByText("Not yok.")).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox")).toBeNull()
  })

  it("adds a release behind the step-up, the commit in small letters; says a taken version", async () => {
    const sent = stubApi(controlPlane(refusal(409, "cp.release_version_taken", "conflict")))
    page("operator")

    await userEvent.click(await screen.findByRole("button", { name: "Sürüm ekle" }))
    const form = await screen.findByRole("dialog", { name: "Sürüm ekle" })
    const submit = within(form).getByRole("button", { name: "Sürüm ekle" })
    await userEvent.type(within(form).getByLabelText("Sürüm numarası"), "1.6")
    expect(within(form).getByText("Sürüm numarası 1.4.0 biçiminde olmalı.")).toBeInTheDocument()
    await userEvent.type(within(form).getByLabelText("Sürüm numarası"), ".0")
    await userEvent.type(within(form).getByLabelText("Commit"), "ABCDEF1234")
    await userEvent.type(within(form).getByLabelText("Not"), "Ödeme sayfası hızlandı")
    expect(submit).toBeEnabled()
    await userEvent.click(submit)
    await proveWithCode()

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Bu sürüm numarası zaten kayıtlı."
    )
    const posts = sent.filter(
      (call) => call.path === "/admin/cp/releases" && call.method === "POST"
    )
    expect(posts.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
    expect(posts[1]?.body).toEqual({
      version: "1.6.0",
      commit: "abcdef1234",
      notes: "Ödeme sayfası hızlandı",
    })
  })

  it("lets who runs shops edit a release's note from its row, behind the step-up", async () => {
    const sent = stubApi(controlPlane())
    page("owner")

    await userEvent.click(await screen.findByRole("button", { name: "1.4.0" }))
    const form = await screen.findByRole("dialog", { name: "Sürüm 1.4.0" })
    expect(within(form).getByText(COMMIT)).toBeInTheDocument()
    const notes = within(form).getByLabelText("Not")
    await userEvent.clear(notes)
    await userEvent.type(notes, "İlçe düzeltmesi ve hız")
    await userEvent.click(within(form).getByRole("button", { name: "Kaydet" }))
    await proveWithCode()

    await waitFor(() => {
      const saved = sent.filter((call) => call.path === "/admin/cp/releases/rel_140")
      expect(saved.at(-1)?.body).toEqual({ notes: "İlçe düzeltmesi ve hız" })
      expect(saved.at(-1)?.headers[STEP_UP_HEADER]).toBe("proof-1")
    })
  })
})

const TARGET = {
  id: "rel_150",
  version: "1.5.0",
  commit: "1234567abc",
  set_at: "2026-11-11T10:00:00.000Z",
  set_by: "Ece Demir",
  reason: "Pilot grubu",
}

const VERSIONED: TenantDetail = {
  ...SHOP,
  tenant: { ...SHOP.tenant, status: "active" },
  version: {
    reported: {
      version: "1.4.0",
      commit: COMMIT.slice(0, 12),
      reported_at: new Date().toISOString(),
    },
    target: TARGET,
    matches: false,
  },
}

const card = (shop: TenantDetail, role: Parameters<typeof renderAs>[1]) =>
  renderAs(
    <>
      <VersionCard shop={shop} />
      <StepUpHost />
    </>,
    role
  )

describe("a shop's Sürüm tab and list column (Ek C18)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.search = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows what it runs, its target and that they differ; reading only, no change", () => {
    stubApi(controlPlane())
    card(
      {
        ...VERSIONED,
        version: { ...VERSIONED.version, target: { ...TARGET, reason: null } },
      },
      "readonly"
    )

    expect(screen.getByText("1.4.0 · 8a128bbe0c3d")).toBeInTheDocument()
    expect(screen.getByText("1.5.0 · 1234567abc")).toBeInTheDocument()
    expect(screen.getByText("Hedefte değil")).toBeInTheDocument()
    expect(screen.getByText(/^Ece Demir · /)).toBeInTheDocument()
    expect(screen.queryByText("Gerekçe")).toBeNull()
    expect(screen.queryByRole("button", { name: "Hedef sürümü değiştir" })).toBeNull()
  })

  it("says when nothing can be compared, and offers no change on a closing shop", () => {
    stubApi(controlPlane())
    card({ ...SHOP, tenant: { ...SHOP.tenant, status: "closing" } }, "owner")

    expect(screen.getByText("Henüz rapor gelmedi")).toBeInTheDocument()
    expect(screen.getByText("Hedef yok")).toBeInTheDocument()
    expect(screen.getByText("Karşılaştırılamıyor")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Hedef sürümü değiştir" })).toBeNull()
  })

  it("changes the target with a reason behind the step-up", async () => {
    const sent = stubApi(controlPlane())
    card(VERSIONED, "operator")

    expect(screen.getByText("Pilot grubu")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Hedef sürümü değiştir" }))
    const form = await screen.findByRole("dialog", { name: "Hedef sürümü değiştir" })
    await userEvent.click(await within(form).findByLabelText(/^1\.4\.0/))
    const save = within(form).getByRole("button", { name: "Kaydet" })
    expect(save).toBeDisabled()
    await userEvent.type(within(form).getByLabelText("Gerekçe"), "Geri dönüş")
    await userEvent.click(save)
    await proveWithCode()

    await waitFor(() => {
      const set = sent.filter((call) => call.path === "/admin/cp/tenants/ten_kahve/target-release")
      expect(set.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
      expect(set[1]?.body).toEqual({ release_id: "rel_140", reason: "Geri dönüş" })
    })
  })

  it("shows the reported version in the shops list and a badge when it is not the target", async () => {
    routerState.search = { status: "all", q: "", page: 1 }
    stubApi(() => ({ status: 200, body: LIST }))
    renderAs(<TenantsPage />, "readonly")

    const row = near(await screen.findByRole("link", { name: "My L'arte" }), "tr")
    expect(within(row).getByText("1.4.0")).toBeInTheDocument()
    expect(within(row).getByText("Hedefte değil")).toBeInTheDocument()
    const other = near(screen.getByRole("link", { name: "Kahve Durağı" }), "tr")
    expect(within(other).queryByText("Hedefte değil")).toBeNull()
  })
})
