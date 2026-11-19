import { cleanup, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  DONE,
  RESULT,
  SCENES,
  json,
  openScene,
  sceneTask,
  tile,
  viewWith,
} from "@/features/ai/components/ai-scene.fixtures"

/**
 * docs/22 "Aşama 7": "Sahneye yerleştir" in the picture dialog. The
 * scenes are the shop's own, then its sector pack's (by code and name),
 * and "Özel" last (ai-scene-custom.spec.tsx). The job is asked for (202)
 * with the scene's code, its result shown beside the original; "Kullan"
 * adds it to the product.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const netFetch = vi.fn()
let services: unknown = viewWith(sceneTask(["gemini"]))

const body = (at = 0): unknown =>
  JSON.parse((netFetch.mock.calls[at]?.[1] as { body: string }).body)

beforeEach(() => {
  services = viewWith(sceneTask(["gemini"]))
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept") || url.endsWith("/dismiss")
      ? json(200, { suggestion: { id: "sug_9", text: "media_scene" } })
      : json(202, { job_id: "job_1", service: "gemini", alternatives: [] })
  )
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services)
    }
    if (url.startsWith("/admin/async-jobs/")) {
      return Promise.resolve({ async_job: DONE })
    }
    return Promise.resolve({ media: RESULT })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("placing a product picture in a scene", () => {
  it("offers the pack's scenes by name and asks with the chosen scene's code", async () => {
    const { user, onAdd } = tile()
    const dialog = await openScene(user)
    const scenes = within(dialog).getByRole("radiogroup", { name: "Sahne" })
    expect(within(scenes).getByRole("radio", { name: "Açık stüdyo masası" })).toBeChecked()
    // "Özel" comes last; its box only once it is chosen
    expect(within(scenes).getAllByRole("radio").at(-1)).toHaveAccessibleName("Özel")
    await user.click(within(scenes).getByRole("radio", { name: "Doğal ışıklı yüzey" }))
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Sahneye yerleştir" }))
    expect(body()).toEqual({
      task: "image_scene",
      entity_type: "media",
      entity_ids: ["media_01"],
      option: "daylight_surface",
    })
    expect(
      await within(dialog).findByRole("img", { name: "Sahneye yerleştirilmiş ürün" })
    ).toHaveAttribute("src", RESULT.url)
    expect(within(dialog).getByRole("img", { name: "Asıl görsel" })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ id: "file_scene", url: RESULT.url })
    })
  })

  it("lists the shop's own scenes first, as the server orders them", async () => {
    const own = { code: "own_abcdefgh", name: { tr: "Bebek odası", en: "Bebek odası" }, own: true }
    services = viewWith(
      sceneTask(["gemini"], {
        options: [own.code, ...SCENES.map((s) => s.code)],
        scenes: [own, ...SCENES],
      })
    )
    const { user } = tile()
    const dialog = await openScene(user)
    const scenes = within(dialog).getByRole("radiogroup", { name: "Sahne" })
    expect(
      within(scenes)
        .getAllByRole("radio")
        .map((each) => each.textContent)
    ).toEqual(["Bebek odası", "Açık stüdyo masası", "Doğal ışıklı yüzey", "Özel"])
    await user.click(within(dialog).getByRole("button", { name: "Sahneye yerleştir" }))
    expect(body()).toMatchObject({ option: "own_abcdefgh" })
  })

  it("lets the staff member pick between two scene services", async () => {
    services = viewWith(sceneTask(["photoroom", "gemini"]))
    const { user } = tile()
    const dialog = await openScene(user)
    await user.click(within(dialog).getByRole("radio", { name: "Photoroom" }))
    await user.click(within(dialog).getByRole("button", { name: "Sahneye yerleştir" }))
    expect(body()).toMatchObject({
      task: "image_scene",
      option: "studio_table",
      service: "photoroom",
    })
  })

  it("with no scene service says how to get one instead of asking", async () => {
    services = viewWith(sceneTask([]))
    const { user } = tile()
    const dialog = await openScene(user)
    expect(within(dialog).getByText(/tek tıkla sahneye yerleştirebilirsiniz/)).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: "Bağla" })).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Sahneye yerleştir" })
    ).not.toBeInTheDocument()
  })

  it("offers no scene mode for a role the task does not allow", async () => {
    services = viewWith(sceneTask(["gemini"], { allowed: false }))
    const { user } = tile()
    await user.click(await screen.findByRole("button", { name: "Görseli düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Görseli düzenle" })
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Görselle ne yapılsın" })
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Vazgeç" }))
    cleanup()
  })
})
