import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MediaDetail } from "@/features/media/api/media"
import { GalleryTile } from "@/features/products/components/gallery-tile"

/**
 * docs/22 "Aşama 7": "Sahneye yerleştir" in the picture dialog. The
 * scenes are the shop's sector pack's (two at most, by code and name);
 * nothing is typed. The job is asked for (202) with the scene's code,
 * its result shown beside the original; "Kullan" adds it to the product.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const SCENES = [
  { code: "studio_table", name: { tr: "Açık stüdyo masası", en: "Bright studio table" } },
  { code: "daylight_surface", name: { tr: "Doğal ışıklı yüzey", en: "Daylight surface" } },
]

const task = (id: string, usable: string[], extra: Record<string, unknown> = {}) => ({
  id,
  capability: "image_edit",
  mode: "job",
  options: ["transparent", "white"],
  allowed: true,
  usable,
  preference: null,
  ...extra,
})
const sceneTask = (usable: string[], extra: Record<string, unknown> = {}) =>
  task("image_scene", usable, { options: SCENES.map((s) => s.code), scenes: SCENES, ...extra })
const service = (id: string, backgrounds: string[]) => ({
  id,
  capabilities: ["image_edit"],
  status: "connected",
  funding: "own_key",
  data_note_key: `ai.data_note.${id}`,
  backgrounds,
  scene: true,
})
const viewWith = (scene: unknown) => ({
  services: [service("photoroom", ["transparent", "white"]), service("gemini", ["white"])],
  tasks: [task("image_background", ["photoroom"]), scene],
  flags: { own_keys: true },
})

const RESULT: MediaDetail = {
  id: "media_scene",
  url: "https://cdn.example.com/kupa-sahne.png",
  file_id: "file_scene",
  filename: "kupa-sahne.png",
  mime_type: "image/png",
  size: 900,
  width: 800,
  height: 800,
  alt: null,
  ai_source: "generated",
  derived_from_id: "media_01",
  created_at: "2026-11-18T10:00:00.000Z",
  uploaded_by: null,
  usage: [],
  derived_from: { id: "media_01", url: "https://cdn.example.com/kupa.webp", filename: "kupa.webp" },
}

const DONE = {
  id: "job_1",
  status: "succeeded",
  progress: 100,
  error_code: null,
  result_summary: {
    done: [{ media_id: "media_01", result_id: "media_scene", suggestion_id: "sug_9" }],
    failed: [],
    skipped: 0,
    stopped_by: null,
  },
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const netFetch = vi.fn()
let services: unknown = viewWith(sceneTask(["gemini"]))

function tile() {
  const onAdd = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <GalleryTile
        image={{
          key: "img_1",
          url: "https://cdn.example.com/kupa.webp",
          alt: { value: "Kupa", legacy: false, versions: "ready", mediaId: "media_01" },
        }}
        index={0}
        count={1}
        disabled={false}
        withAlt
        open
        onOpenChange={vi.fn()}
        dragging={false}
        target={false}
        drag={{ start: vi.fn(), over: vi.fn(), end: vi.fn(), drop: vi.fn() }}
        onMakeMain={vi.fn()}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onAlt={vi.fn()}
        onAddImage={onAdd}
        room={{ full: false, max: 20 }}
      />
    </QueryClientProvider>
  )
  return { user: userEvent.setup(), onAdd }
}

const body = (at = 0): unknown =>
  JSON.parse((netFetch.mock.calls[at]?.[1] as { body: string }).body)

async function openScene(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Arka planı temizle" }))
  const dialog = await screen.findByRole("dialog", { name: "Arka planı temizle" })
  const modes = within(dialog).getByRole("radiogroup", { name: "Görselle ne yapılsın" })
  await user.click(within(modes).getByRole("radio", { name: "Sahneye yerleştir" }))
  return screen.findByRole("dialog", { name: "Sahneye yerleştir" })
}

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
    await user.click(within(scenes).getByRole("radio", { name: "Doğal ışıklı yüzey" }))
    // Nothing to type: no text box anywhere in the dialog
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

  it("names the only scene in words when the pack has one", async () => {
    services = viewWith(
      sceneTask(["gemini"], { options: ["studio_table"], scenes: SCENES.slice(0, 1) })
    )
    const { user } = tile()
    const dialog = await openScene(user)
    expect(within(dialog).getByText("Sahne: Açık stüdyo masası.")).toBeInTheDocument()
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

  it("offers no scene mode without scenes or for a role the task does not allow", async () => {
    for (const scene of [
      sceneTask(["gemini"], { scenes: [] }),
      sceneTask(["gemini"], { allowed: false }),
    ]) {
      services = viewWith(scene)
      const { user } = tile()
      await user.click(await screen.findByRole("button", { name: "Arka planı temizle" }))
      const dialog = await screen.findByRole("dialog", { name: "Arka planı temizle" })
      expect(
        within(dialog).queryByRole("radiogroup", { name: "Görselle ne yapılsın" })
      ).not.toBeInTheDocument()
      await user.click(within(dialog).getByRole("button", { name: "Vazgeç" }))
      cleanup()
    }
  })
})
