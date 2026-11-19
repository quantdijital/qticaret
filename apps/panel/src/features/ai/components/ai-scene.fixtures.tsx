import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, vi } from "vitest"
import type { MediaDetail } from "@/features/media/api/media"
import { GalleryTile } from "@/features/products/components/gallery-tile"

/**
 * The picture dialog's scene tests (docs/22 Aşama 7): the services view,
 * a finished job and its result, and the product gallery tile the dialog
 * opens from. Each spec mocks `@/lib/sdk` and `fetch` itself.
 */

export const SCENES = [
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

export const sceneTask = (usable: string[], extra: Record<string, unknown> = {}) =>
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

export const viewWith = (scene: unknown) => ({
  services: [service("photoroom", ["transparent", "white"]), service("gemini", ["white"])],
  tasks: [task("image_background", ["photoroom"]), scene],
  flags: { own_keys: true },
})

export const RESULT: MediaDetail = {
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

export const DONE = {
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

export const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

/** The product gallery's tile with its picture dialog; `onAdd` gets the picture used. */
export function tile() {
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

/** Opens the picture dialog and switches it to "Sahneye yerleştir". */
export async function openScene(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Görseli düzenle" }))
  const dialog = await screen.findByRole("dialog", { name: "Görseli düzenle" })
  const modes = within(dialog).getByRole("radiogroup", { name: "Görselle ne yapılsın" })
  // Two modes in the one window: cleaning first (as before), the scene beside it
  expect(within(modes).getByRole("radio", { name: "Arka planı temizle" })).toBeChecked()
  await user.click(within(modes).getByRole("radio", { name: "Sahneye yerleştir" }))
  return dialog
}
