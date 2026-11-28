import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { ProvisioningState } from "@/features/provisioning/api"
import { VersionTab } from "@/features/releases/components/version-tab"
import type { LastBackup, TenantDetail } from "@/features/tenants/api"
import { TenantsPage } from "@/features/tenants/pages/tenants-page"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { SET_UP, run, state } from "@/test/runs"
import { LIST, SHOP } from "@/test/shops"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

const BACKUP: LastBackup = {
  status: "succeeded",
  at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  bytes: 12_582_912,
  files: true,
  error_code: null,
  run_id: "prun_bak",
}

const ACTIVE: TenantDetail = {
  ...SHOP,
  tenant: { ...SHOP.tenant, status: "active" },
  version: {
    reported: { version: "1.4.0", commit: "8a128bbe0c3d", reported_at: new Date().toISOString() },
    target: {
      id: "rel_150",
      version: "1.5.0",
      commit: "1234567abc",
      set_at: "2026-11-11T10:00:00.000Z",
      set_by: "Ece Demir",
      reason: "Pilot grubu",
    },
    matches: false,
  },
  backup: BACKUP,
}

const runs =
  (provisioning: ProvisioningState) =>
  (call: Sent): Answer => {
    if (call.path.endsWith("/provisioning") && call.method === "GET") {
      return { status: 200, body: provisioning }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (call.method === "POST") {
      if (!call.headers[STEP_UP_HEADER]) {
        return refusal(428, "cp.step_up_required")
      }
      return { status: 202, body: { run: run({ status: "running", finished_at: null }) } }
    }
    return { status: 200, body: {} }
  }

const tab = (shop: TenantDetail, role: Parameters<typeof renderAs>[1]) =>
  renderAs(
    <>
      <VersionTab shop={shop} />
      <StepUpHost />
    </>,
    role
  )

async function prove() {
  await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

describe("a shop's upgrade and backup (audit 3.1, 3.2)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.search = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the latest backup to every role, the runbook for restore, no action to read-only", () => {
    const sent = stubApi(runs(state(SET_UP)))
    tab(ACTIVE, "readonly")

    const card = screen.getByRole("heading", { name: "Yedek" }).closest("section")
    if (!(card instanceof HTMLElement)) {
      throw new Error("no card around the heading")
    }
    const inside = within(card)
    expect(inside.getByText("Alındı")).toBeInTheDocument()
    expect(inside.getByText(/12 MB · Dosyalar dahil/)).toBeInTheDocument()
    expect(inside.getByRole("link", { name: /Geri yükleme adımları/ })).toHaveAttribute(
      "href",
      expect.stringContaining("docs/runbooks/yedek-ve-geri-yukleme.md")
    )
    expect(screen.queryByRole("button", { name: "Şimdi yedekle" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Sürüm yükseltme" })).toBeNull()
    // A role that may not read the runs never asks for them
    expect(sent.filter((call) => call.path.includes("/provisioning"))).toEqual([])
  })

  it("says why a backup failed", () => {
    stubApi(runs(state(SET_UP)))
    tab(
      {
        ...ACTIVE,
        backup: {
          ...BACKUP,
          status: "failed",
          bytes: null,
          files: null,
          error_code: "provisioning.backup_age_missing",
        },
      },
      "operator"
    )
    expect(screen.getByText("Alınamadı")).toBeInTheDocument()
    expect(screen.getByText(/age bu makinede kurulu değil/)).toBeInTheDocument()
  })

  it("backs up now behind a step-up", async () => {
    const sent = stubApi(runs(state(SET_UP)))
    tab(ACTIVE, "operator")

    const button = await screen.findByRole("button", { name: "Şimdi yedekle" })
    await waitFor(() => {
      expect(button).toBeEnabled()
    })
    await userEvent.click(button)
    await prove()
    await waitFor(() => {
      expect(
        sent.some(
          (call) =>
            call.method === "POST" &&
            call.path.endsWith("/provisioning/backup") &&
            call.headers[STEP_UP_HEADER] === "proof-1"
        )
      ).toBe(true)
    })
  })

  it("asks before upgrading to the target, then starts the run behind a step-up", async () => {
    const sent = stubApi(runs(state(SET_UP)))
    tab(ACTIVE, "owner")

    expect(screen.getByText("Bu mağaza henüz yükseltilmedi.")).toBeInTheDocument()
    const button = await screen.findByRole("button", { name: "Sürümü yükselt" })
    await waitFor(() => {
      expect(button).toBeEnabled()
    })
    await userEvent.click(button)
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/1\.5\.0 sürümüne geçecek/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Sürümü yükselt" }))
    await prove()
    await waitFor(() => {
      expect(
        sent.some((call) => call.method === "POST" && call.path.endsWith("/provisioning/upgrade"))
      ).toBe(true)
    })
  })

  it("offers no upgrade without a target, on the target, or while a run goes; shows the last one's failure", async () => {
    stubApi(runs(state(SET_UP)))
    const { unmount } = tab({ ...ACTIVE, version: { ...ACTIVE.version, target: null } }, "owner")
    expect(await screen.findByText("Önce hedef sürüm seçin.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sürümü yükselt" })).toBeDisabled()
    unmount()

    const failed = run({
      id: "prun_up",
      kind: "upgrade",
      status: "failed",
      error_code: "provisioning.release_not_built",
    })
    stubApi(runs(state(failed, [SET_UP])))
    tab({ ...ACTIVE, version: { ...ACTIVE.version, matches: true } }, "owner")
    expect(await screen.findByText("Mağaza hedef sürümü çalıştırıyor.")).toBeInTheDocument()
    expect(screen.getByText(/derlenmiş değil/)).toBeInTheDocument()
    expect(screen.getByText("Tamamlanamadı")).toBeInTheDocument()
  })

  it("shows each shop's latest backup under its health in the list", async () => {
    stubApi((call) =>
      call.path.startsWith("/admin/cp/tenants")
        ? { status: 200, body: LIST }
        : { status: 200, body: {} }
    )
    routerState.search = { status: "all", q: "", page: 1 }
    renderAs(<TenantsPage />, "readonly")
    await screen.findByText("My L'arte")
    expect(screen.getByText(/^Yedek .*önce$/)).toBeInTheDocument()
    expect(screen.getByText("Yedek yok")).toBeInTheDocument()
  })
})
