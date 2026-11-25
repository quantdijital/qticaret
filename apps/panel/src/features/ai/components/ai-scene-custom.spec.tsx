import { waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  DONE,
  RESULT,
  json,
  openScene,
  sceneTask,
  tile,
  viewWith,
} from "@/features/ai/components/ai-scene.fixtures"

/**
 * docs/22 "Aşama 7": the "Özel" scene. One box for the background (200
 * characters, counted), sent as `prompt` in place of a code; or, with
 * "Sahnelerime kaydet", kept among the shop's scenes first (the
 * `ai_scenes` section) and asked for by the id the server gave it. A shop
 * with no scene at all still has "Özel".
 */

const sdkFetch = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true, useStaff: () => undefined }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const netFetch = vi.fn()
let services: unknown = viewWith(sceneTask(["gemini"]))
let stored: { id: string; name: string; prompt: string }[] = []
const saves: unknown[] = []
let job: unknown = DONE

const body = (at = 0): unknown =>
  JSON.parse((netFetch.mock.calls[at]?.[1] as { body: string }).body)

beforeEach(() => {
  services = viewWith(sceneTask(["gemini"]))
  stored = []
  saves.length = 0
  job = DONE
  netFetch.mockReset()
  netFetch.mockImplementation(() =>
    json(202, { job_id: "job_1", service: "gemini", alternatives: [] })
  )
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services)
    }
    if (url === "/admin/platform-settings/ai_scenes") {
      if (init?.method === "POST") {
        saves.push(init.body)
        const sent = (init.body as { scenes: { id?: string; name: string; prompt: string }[] })
          .scenes
        stored = sent.map((each, at) => ({ ...each, id: each.id ?? `own_new0000${String(at)}` }))
      }
      const values = { show_pack_scenes: true, scenes: stored }
      return Promise.resolve({ section: "ai_scenes", values, version: 1 })
    }
    if (url.startsWith("/admin/async-jobs/")) {
      return Promise.resolve({ async_job: job })
    }
    return Promise.resolve({ media: RESULT })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function chooseCustom(user: ReturnType<typeof tile>["user"]) {
  const dialog = await openScene(user)
  await user.click(within(dialog).getByRole("radio", { name: "Özel" }))
  return dialog
}

describe("a scene typed once", () => {
  it("asks with the typed words in place of a code, counted to 200", async () => {
    const { user } = tile()
    const dialog = await chooseCustom(user)
    const start = within(dialog).getByRole("button", { name: "Sahneye yerleştir" })
    // Nothing typed: nothing to ask for
    expect(start).toBeDisabled()
    const box = within(dialog).getByRole("textbox", { name: "Sahneyi tarif edin" })
    expect(box).toHaveAttribute("maxlength", "200")
    expect(box).toHaveAttribute("placeholder", "pembe battaniye üstünde, yumuşak gün ışığı")
    // Under the box: what to write, and no personal details (only patterns are taken out)
    expect(box).toHaveAccessibleDescription(expect.stringContaining("Kişisel bilgi yazmayın."))
    await user.type(box, "taş zemin, sabah ışığı")
    expect(within(dialog).getByText("22/200")).toBeInTheDocument()
    // The name only once "Sahnelerime kaydet" is ticked
    expect(within(dialog).queryByRole("textbox", { name: "Sahne adı" })).not.toBeInTheDocument()
    await user.click(start)
    expect(body()).toEqual({
      task: "image_scene",
      entity_type: "media",
      entity_ids: ["media_01"],
      prompt: "taş zemin, sabah ışığı",
    })
    expect(saves).toEqual([])
    expect(
      await within(dialog).findByRole("img", { name: "Sahneye yerleştirilmiş ürün" })
    ).toHaveAttribute("src", RESULT.url)
  })

  it("keeps it among the shop's scenes first, then asks by the id it got", async () => {
    stored = [{ id: "own_old00000", name: "Taş", prompt: "taş zemin" }]
    const { user } = tile()
    const dialog = await chooseCustom(user)
    await user.type(
      within(dialog).getByRole("textbox", { name: "Sahneyi tarif edin" }),
      "pembe battaniye üstünde, yumuşak gün ışığı"
    )
    await user.click(within(dialog).getByRole("checkbox", { name: "Sahnelerime kaydet" }))
    expect(within(dialog).getByRole("textbox", { name: "Sahne adı" })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Sahneye yerleştir" }))
    await waitFor(() => {
      expect(netFetch).toHaveBeenCalled()
    })
    // The list is sent whole: the stored one kept, the new one named by its first words
    expect(saves).toEqual([
      {
        scenes: [
          { id: "own_old00000", name: "Taş", prompt: "taş zemin" },
          {
            name: "pembe battaniye üstünde, yumuşak",
            prompt: "pembe battaniye üstünde, yumuşak gün ışığı",
          },
        ],
      },
    ])
    expect(body()).toMatchObject({ option: "own_new00001" })
    expect(body()).not.toHaveProperty("prompt")
  })

  it("says so and asks nothing when twelve scenes are kept already", async () => {
    stored = Array.from({ length: 12 }, (_, at) => ({
      id: `own_full000${String(at).padStart(2, "0")}`,
      name: `Sahne ${String(at)}`,
      prompt: "taş",
    }))
    const { user } = tile()
    const dialog = await chooseCustom(user)
    await user.type(within(dialog).getByRole("textbox", { name: "Sahneyi tarif edin" }), "masa")
    await user.click(within(dialog).getByRole("checkbox", { name: "Sahnelerime kaydet" }))
    await user.click(within(dialog).getByRole("button", { name: "Sahneye yerleştir" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "En çok 12 sahne kaydedilebilir."
    )
    expect(saves).toEqual([])
    expect(netFetch).not.toHaveBeenCalled()
  })

  it("sends the same words to the other service after a used-up quota", async () => {
    services = viewWith(sceneTask(["gemini", "photoroom"], { preference: "gemini" }))
    job = {
      ...DONE,
      result_summary: {
        done: [],
        failed: [{ media_id: "media_01", key: "ai.provider_quota" }],
        skipped: 0,
      },
    }
    const { user } = tile()
    const dialog = await chooseCustom(user)
    await user.type(
      within(dialog).getByRole("textbox", { name: "Sahneyi tarif edin" }),
      "taş zemin, sabah ışığı"
    )
    await user.click(within(dialog).getByRole("button", { name: "Sahneye yerleştir" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Gemini hesabınızın kotası/)
    await user.click(within(dialog).getByRole("button", { name: "Photoroom ile dene" }))
    await waitFor(() => {
      expect(body(1)).toMatchObject({ prompt: "taş zemin, sabah ışığı", service: "photoroom" })
    })
    // Never a pack scene in place of the words typed
    expect(body(1)).not.toHaveProperty("option")
  })

  it("is offered on its own when the shop shows no scene", async () => {
    services = viewWith(sceneTask(["gemini"], { options: [], scenes: [] }))
    const { user } = tile()
    const dialog = await openScene(user)
    const scenes = within(dialog).getByRole("radiogroup", { name: "Sahne" })
    expect(within(scenes).getByRole("radio", { name: "Özel" })).toBeChecked()
    expect(within(dialog).getByRole("textbox", { name: "Sahneyi tarif edin" })).toBeInTheDocument()
  })
})
