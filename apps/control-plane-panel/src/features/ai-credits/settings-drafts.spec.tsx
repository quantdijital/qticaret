import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Toaster } from "@qticaret/admin-ui/patterns/toaster"
import "@/lib/i18n"
import type { AiSettingsAnswer } from "@/features/ai-credits/api/schemas"
import { AiSettingsPage } from "@/features/ai-credits/pages/ai-settings-page"
import { forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { PROVIDERS, SETTINGS } from "@/test/ai-settings"
import { renderAs } from "@/test/member"

type Stored = AiSettingsAnswer["settings"]

/** The settings as stored: a save writes its part over them, as the control plane does. */
function controlPlane(stored: { answer: AiSettingsAnswer }) {
  return (call: Sent): Answer => {
    if (call.path === "/admin/cp/ai/settings" && call.method === "POST") {
      const { routing, ...rest } = call.body as Partial<Omit<Stored, "routing">> & {
        routing?: Record<string, unknown>
      }
      const settings = { ...stored.answer.settings, ...rest }
      stored.answer = {
        ...stored.answer,
        settings: {
          ...settings,
          // A route set to null is taken away
          routing: routing
            ? Object.fromEntries(Object.entries(routing).filter(([, route]) => route !== null))
            : settings.routing,
          updated_at: "2026-11-25T10:00:00.000Z",
        },
      }
    }
    if (call.path === "/admin/cp/ai/settings") {
      return { status: 200, body: stored.answer }
    }
    if (call.path === "/admin/cp/ai/providers") {
      return { status: 200, body: PROVIDERS }
    }
    return { status: 200, body: {} }
  }
}

const page = () =>
  renderAs(
    <>
      <AiSettingsPage />
      <Toaster />
    </>,
    "owner"
  )

async function routeTextOff() {
  const text = await screen.findByRole("radiogroup", { name: "Metin yazma: servis ve model" })
  await userEvent.click(within(text).getByRole("radio", { name: /^Kapalı/ }))
}

/** The page's n-th "Kaydet": the routing card's first, then the general card's. */
function nthSave(n: number) {
  const button = screen.getAllByRole("button", { name: "Kaydet" })[n]
  if (!button) {
    throw new Error(`no save button ${String(n)}`)
  }
  return button
}

describe("the AI settings cards' drafts (adr/0085 §5)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps another card's unsaved draft when one card is saved", async () => {
    const stored = { answer: SETTINGS }
    const sent = stubApi(controlPlane(stored))
    page()

    const cap = await screen.findByLabelText("Genel günlük tavan")
    await userEvent.clear(cap)
    await userEvent.type(cap, "450")
    await routeTextOff()
    // The routing card's save comes first on the page
    const routingSave = nthSave(0)
    await userEvent.click(routingSave)

    expect(await screen.findByText("Yönlendirme kaydedildi.")).toBeInTheDocument()
    await waitFor(() => {
      expect(stored.answer.settings.updated_at).toBe("2026-11-25T10:00:00.000Z")
    })
    const posts = sent.filter((call) => call.method === "POST")
    expect(posts.map((call) => call.body)).toEqual([
      { routing: { text: null, vision: null, image_edit: null } },
    ])
    expect(screen.getByLabelText("Genel günlük tavan")).toHaveValue("450")
  })

  it("does not write over a part someone else changed under the draft", async () => {
    const stored = { answer: SETTINGS }
    const sent = stubApi(controlPlane(stored))
    page()

    const cap = await screen.findByLabelText("Genel günlük tavan")
    await userEvent.clear(cap)
    await userEvent.type(cap, "450")
    // Another owner saves a different cap meanwhile
    stored.answer = {
      ...SETTINGS,
      settings: { ...SETTINGS.settings, daily_cap: 999, updated_at: "2026-11-25T09:30:00.000Z" },
    }
    const generalSave = nthSave(1)
    await userEvent.click(generalSave)

    expect(
      await screen.findByText("Ayarlar bu arada değişti. Sayfayı yenileyip yeniden deneyin.")
    ).toBeInTheDocument()
    expect(sent.filter((call) => call.method === "POST")).toEqual([])
    expect(screen.getByLabelText("Genel günlük tavan")).toHaveValue("450")
  })

  it("says a failed providers read under the settings too, and reads again on retry", async () => {
    const stored = { answer: SETTINGS }
    let down = true
    const base = controlPlane(stored)
    stubApi((call) =>
      down && call.path === "/admin/cp/ai/providers" ? refusal(500, "boom") : base(call)
    )
    page()

    // The providers card's and the settings' own: no endless skeleton
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Tekrar dene" })).toHaveLength(2)
    })
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    down = false
    const retry = screen.getAllByRole("button", { name: "Tekrar dene" }).at(-1)
    if (!retry) {
      throw new Error("no retry")
    }
    await userEvent.click(retry)

    expect(
      await screen.findByRole("radiogroup", { name: "Metin yazma: servis ve model" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Genel günlük tavan")).toHaveValue("300")
  })
})
