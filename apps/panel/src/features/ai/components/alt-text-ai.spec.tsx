import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { MediaDetailDialog } from "@/features/media/components/media-detail-dialog"
import type { MediaDetail } from "@/features/media/api/media"
import { GalleryTile } from "@/features/products/components/gallery-tile"
import type { GalleryImage } from "@/features/products/components/gallery-tile"

/**
 * docs/22 "Aşama 5": the alt text's AI button beside the field, on a
 * product's picture and in the media library. "Kullan" fills the field
 * only; the field's own save writes it.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ edit: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => can.edit }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const SUGGESTED = "Ahşap masa üzerinde beyaz seramik kupa"

const SERVICES = {
  services: [],
  tasks: [
    {
      id: "image_alt_text",
      capability: "vision",
      mode: "sync",
      options: [],
      allowed: true,
      usable: ["gemini"],
      preference: null,
    },
  ],
  flags: { own_keys: true },
}

const MEDIA: MediaDetail = {
  id: "media_01",
  url: "https://cdn.example.com/kupa.webp",
  file_id: "file_01",
  filename: "kupa.webp",
  mime_type: "image/webp",
  size: 1000,
  width: 800,
  height: 800,
  alt: null,
  created_at: "2026-11-18T10:00:00.000Z",
  uploaded_by: null,
  usage: [],
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const netFetch = vi.fn()

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
  return userEvent.setup()
}

const tileImage = (alt: Partial<NonNullable<GalleryImage["alt"]>> = {}): GalleryImage => ({
  key: "img_1",
  url: "https://cdn.example.com/kupa.webp",
  alt: { value: "", legacy: false, versions: "ready", mediaId: "media_01", ...alt },
})

function tile(image: GalleryImage, onAlt = vi.fn()) {
  const user = wrap(
    <GalleryTile
      image={image}
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
      onAlt={onAlt}
    />
  )
  return { user, onAlt }
}

const posted = () => netFetch.mock.calls.map(([url]) => String(url))

beforeEach(() => {
  can.edit = true
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text: SUGGESTED } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: "image_alt_text",
            service: "gemini",
            status: "draft",
            text: SUGGESTED,
            alternatives: [],
          },
        })
  )
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(url === "/admin/ai/services" ? SERVICES : { media: MEDIA })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a product picture's alt text", () => {
  it("names the field's AI button, asks for the image and fills the field without saving", async () => {
    const { user, onAlt } = tile(tileImage())
    await user.click(
      await screen.findByRole("button", { name: "1. görselin alt metni için yapay zekâ önerisi" })
    )
    expect(await screen.findByText(SUGGESTED)).toBeInTheDocument()
    expect(screen.getByText(/Görselde kişi varsa/)).toBeInTheDocument()
    expect(JSON.parse((netFetch.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
      task: "image_alt_text",
      entity_type: "media",
      entity_id: "media_01",
    })
    await user.click(screen.getByRole("button", { name: "Kullan" }))
    const field = screen.getByLabelText("1. görsel")
    await waitFor(() => {
      expect(field).toHaveValue(SUGGESTED)
    })
    // Nothing saved by the suggestion: no save, no write route
    expect(onAlt).not.toHaveBeenCalled()
    expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
    // The field's own save, as for a typed text
    field.focus()
    await user.keyboard("{Enter}")
    expect(onAlt).toHaveBeenCalledWith(SUGGESTED)
  })

  it("has no AI button for an old picture added by address or one with no stored file", async () => {
    tile(tileImage({ legacy: true }))
    await screen.findByLabelText("1. görsel")
    expect(screen.queryByRole("button", { name: /yapay zekâ önerisi/ })).not.toBeInTheDocument()
  })

  it("has none without a media record", async () => {
    tile(tileImage({ mediaId: null }))
    await screen.findByLabelText("1. görsel")
    expect(screen.queryByRole("button", { name: /yapay zekâ önerisi/ })).not.toBeInTheDocument()
  })
})

describe("a library picture's alt text", () => {
  const dialog = () =>
    wrap(
      <MediaDetailDialog
        id="media_01"
        steps={{ index: 0, total: 1, onGo: vi.fn() }}
        onClose={vi.fn()}
      />
    )

  it("fills the field from a suggestion; Save is the form's, not the suggestion's", async () => {
    const user = dialog()
    await user.click(
      await screen.findByRole("button", { name: "Alt metin için yapay zekâ önerisi" })
    )
    await user.click(await screen.findByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Alt metin")).toHaveValue(SUGGESTED)
    })
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument()
    const writes = sdkFetch.mock.calls.filter(
      (call) => (call[1] as { method?: string } | undefined)?.method === "POST"
    )
    expect(writes).toEqual([])
  })

  it("offers no button to a role that cannot edit", async () => {
    can.edit = false
    dialog()
    await screen.findByLabelText("Alt metin")
    expect(screen.queryByRole("button", { name: /yapay zekâ önerisi/ })).not.toBeInTheDocument()
  })

  it("offers none for an SVG logo", async () => {
    sdkFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/ai/services"
          ? SERVICES
          : { media: { ...MEDIA, mime_type: "image/svg+xml" } }
      )
    )
    dialog()
    await screen.findByLabelText("Alt metin")
    expect(screen.queryByRole("button", { name: /yapay zekâ önerisi/ })).not.toBeInTheDocument()
  })
})
