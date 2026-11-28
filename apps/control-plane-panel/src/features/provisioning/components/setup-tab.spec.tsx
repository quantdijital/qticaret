import { focusManager } from "@tanstack/react-query"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { FAILED, RUNNING, SET_UP, state } from "@/test/runs"
import { SECTOR_PACKS } from "@/test/sector-packs"
import { SHOP } from "@/test/shops"
import type { ProvisioningState } from "@/features/provisioning/api"
import { SetupTab } from "./setup-tab"

const BASE = "/admin/cp/tenants/ten_kahve/provisioning"
const ACTIVE = { ...SHOP, tenant: { ...SHOP.tenant, status: "active" as const } }

/** The control plane answering the shop's runs with each state in turn (the last one kept). */
function controlPlane(states: ProvisioningState[]) {
  let read = 0
  return (call: Sent): Answer => {
    if (call.path === BASE && call.method === "GET") {
      const answer = states[Math.min(read, states.length - 1)]
      read += 1
      return { status: 200, body: answer }
    }
    if (call.path === "/admin/cp/sector-packs") {
      return { status: 200, body: SECTOR_PACKS }
    }
    if (call.path === `${BASE}/runs/prun_0`) {
      return { status: 200, body: { run: FAILED } }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return {
        status: 200,
        body: {
          step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
        },
      }
    }
    if (call.path.startsWith(BASE) && call.method === "POST") {
      return call.headers[STEP_UP_HEADER]
        ? { status: 202, body: { run: RUNNING } }
        : refusal(428, "cp.step_up_required")
    }
    return { status: 404, body: {} }
  }
}

const reads = (sent: Sent[]) =>
  sent.filter((call) => call.path === BASE && call.method === "GET").length

describe("SetupTab: the shop's setup (C11, Ek C10)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    focusManager.setFocused(undefined)
  })

  it("shows the latest run's steps in words, its warning, outputs, history and local panel", async () => {
    stubApi(controlPlane([state(SET_UP, [FAILED])]))
    renderAs(<SetupTab shop={ACTIVE} />, "operator")

    const steps = await screen.findByRole("list", { name: "Kurulum adımları" })
    expect(within(steps).getByText("Port ayırma")).toBeInTheDocument()
    expect(within(steps).getByText("Port 9200")).toBeInTheDocument()
    expect(within(steps).getByText("Belge no 1")).toBeInTheDocument()
    expect(within(steps).getByText("Yanıt 35 ms")).toBeInTheDocument()
    expect(within(steps).getByText(/E-posta gönderimi kapalı/)).toBeInTheDocument()
    expect(within(steps).getByText("provisioning.mail_off")).toBeInTheDocument()
    expect(screen.getByText("Sahip daveti: uyarı")).toBeInTheDocument()
    // The run's status in words: on the latest run and its row in the history
    expect(screen.getAllByText("Tamamlandı")).toHaveLength(2)
    // The history, newest first; the failure in words
    const history = screen.getByRole("table")
    expect(within(history).getAllByRole("row")).toHaveLength(3)
    expect(
      within(history).getByText("Mağaza sunucusu süresi içinde sağlıklı yanıt vermedi.")
    ).toBeInTheDocument()
    // The shop's own panel on this machine, started with it: its port plus 1000
    const open = screen.getByRole("link", { name: "Paneli aç" })
    expect(open).toHaveAttribute("href", "http://localhost:10200")
    expect(open).toHaveAttribute("rel", "noopener noreferrer")
    expect(
      screen.getByText(
        "PANEL_PORT=10200 PANEL_BACKEND_URL=http://localhost:9200 pnpm --filter panel dev"
      )
    ).toBeInTheDocument()
  })

  it("opens a run of the history with its steps, the undone one said", async () => {
    stubApi(controlPlane([state(SET_UP, [FAILED])]))
    renderAs(<SetupTab shop={ACTIVE} />, "operator")

    await userEvent.click((await screen.findAllByRole("button", { name: "Kurulum" }))[1] as Element)
    const dialog = await screen.findByRole("dialog", { name: "Kurulum" })
    expect(await within(dialog).findByText(/^Geri alındı ·/)).toBeInTheDocument()
    expect(within(dialog).getByText("Kurulum tamamlanamadı")).toBeInTheDocument()
    expect(within(dialog).getByText(/2\. deneme/)).toBeInTheDocument()
  })

  it("reads the run every two seconds while it goes and stops once it ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const sent = stubApi(controlPlane([state(RUNNING), state(RUNNING), state(SET_UP)]))
    const { client } = renderAs(<SetupTab shop={SHOP} />, "operator")
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await screen.findByText("Veritabanı şeması")
    expect(reads(sent)).toBe(1)
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    await waitFor(() => {
      expect(reads(sent)).toBe(2)
    })
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    await screen.findByText("Etkinleştirme")
    expect(reads(sent)).toBe(3)
    // Ended: the shop's page is read again (it is active now), the polling stops
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tenants", "detail", "ten_kahve"] })
    await act(() => vi.advanceTimersByTimeAsync(6_000))
    expect(reads(sent)).toBe(3)
  })

  it("asks nothing while the browser tab is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const sent = stubApi(controlPlane([state(RUNNING)]))
    renderAs(<SetupTab shop={SHOP} />, "operator")
    await screen.findByText("Veritabanı şeması")

    act(() => {
      focusManager.setFocused(false)
    })
    await act(() => vi.advanceTimersByTimeAsync(6_000))

    expect(reads(sent)).toBe(1)
  })

  it("offers no action while a run goes, and says why", async () => {
    stubApi(controlPlane([state(RUNNING)]))
    renderAs(<SetupTab shop={SHOP} />, "operator")

    await screen.findByText("Bir çalışma sürüyor; bitince işlemler açılır.")
    for (const name of [
      "Yeniden dene",
      "Başlat",
      "Durdur",
      "Daveti yeniden gönder",
      "Paketi uygula",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled()
    }
  })

  it("shows the shop's sector pack and its version, and a newer one (C12)", async () => {
    stubApi(controlPlane([state(SET_UP)]))
    const applied = {
      ...ACTIVE,
      tenant: {
        ...ACTIVE.tenant,
        sector_pack: "cutlery",
        sector_pack_version: 1,
        sector_pack_applied_at: "2026-11-11T10:00:00.000Z",
      },
    }
    renderAs(<SetupTab shop={applied} />, "operator")

    expect(await screen.findByText("Bıçak ve çatal-bıçak")).toBeInTheDocument()
    expect(screen.getByText("Sürüm 1")).toBeInTheDocument()
    expect(screen.getByText(/Paketin yeni sürümü var \(sürüm 2\)/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Paketi yeniden uygula" })).toBeEnabled()
  })

  it("says a pack not applied yet and offers it only once the shop is set up", async () => {
    stubApi(controlPlane([state(null)]))
    renderAs(<SetupTab shop={SHOP} />, "operator")

    expect(await screen.findByText("Henüz uygulanmadı")).toBeInTheDocument()
    // No pack on the record: the general one
    expect(await screen.findByText("Genel")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Paketi uygula" })).toBeDisabled()
    expect(screen.queryByText(/yeni sürümü var/)).not.toBeInTheDocument()
  })

  it("applies the pack again with a step-up", async () => {
    const sent = stubApi(controlPlane([state(SET_UP)]))
    renderAs(
      <>
        <SetupTab shop={ACTIVE} />
        <StepUpHost />
      </>,
      "owner"
    )

    await userEvent.click(await screen.findByRole("button", { name: "Paketi uygula" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(
        sent.find((call) => call.path === `${BASE}/apply-pack` && call.headers[STEP_UP_HEADER])
      ).toMatchObject({ method: "POST", body: {} })
    })
  })

  it("stops the shop after asking, with a step-up", async () => {
    const sent = stubApi(controlPlane([state(SET_UP)]))
    renderAs(
      <>
        <SetupTab shop={ACTIVE} />
        <StepUpHost />
      </>,
      "operator"
    )

    expect(await screen.findByRole("button", { name: "Yeniden dene" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Durdur" }))
    const confirm = await screen.findByRole("alertdialog", { name: "Mağaza sunucusunu durdur" })
    await userEvent.click(within(confirm).getByRole("button", { name: "Durdur" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(
        sent.find((call) => call.path === `${BASE}/stop` && call.headers[STEP_UP_HEADER])
      ).toBeDefined()
    })
  })
})
