import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { looksLikeYoutube } from "@/features/media/video-intake"
import type { ProductDetail } from "@/features/products/api/products"
import type { ProductVideo } from "@/features/products/api/videos"
import { MediaCard } from "./media-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { upload: { create: vi.fn() }, product: { update: vi.fn() } },
  },
}))
vi.mock("@/features/products/api/video-upload", () => ({ uploadProductVideo: vi.fn() }))
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: toastSuccess, warning: vi.fn() },
}))

const ID = "dQw4w9WgXcQ"
const PRODUCT = {
  id: "prod_1",
  images: [{ id: "img_1", url: "https://cdn/on.jpg", rank: 0 }],
  media_assets: [],
} as unknown as ProductDetail

const video = (id: string, fields: Partial<ProductVideo> = {}): ProductVideo => ({
  id,
  kind: "youtube",
  status: "ready",
  title: "Bileme rehberi",
  position: 1,
  width: null,
  height: null,
  duration_ms: null,
  outputs: null,
  poster: { url: `https://cdn/${id}.jpg`, width: 1280, height: 720 },
  youtube_id: ID,
  error_code: null,
  retryable: false,
  created_at: "2026-11-17T10:00:00Z",
  ...fields,
})

let videos: ProductVideo[] = []
let upload = true
let added: () => Promise<unknown> = () => Promise.resolve({ video: video("mvid_new") })

const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => url === path)

function serve() {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/admin/features") {
      return Promise.resolve({
        features: [{ key: "catalog.product_videos", owner: "platform", enabled: true }],
      })
    }
    if (url === "/admin/products/prod_1/videos") {
      return Promise.resolve({ videos, limit: 2, upload })
    }
    if (url === "/admin/products/prod_1/videos/youtube") {
      return added()
    }
    if (url === "/admin/media/import") {
      return Promise.resolve({ media: { id: "med_1", url: "https://cdn/yeni.jpg" } })
    }
    return Promise.resolve({ media: [], count: 0 })
  })
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MediaCard product={PRODUCT} />
    </QueryClientProvider>
  )
}

/** The media dialog's "Adres" tab, opened from the gallery's zone. */
async function addressTab() {
  const zone = await screen.findByRole("button", { name: /Görsel ya da video ekle: sürükleyin/ })
  await userEvent.click(zone)
  const dialog = await screen.findByRole("dialog", { name: "Görsel ya da video ekle" })
  await userEvent.click(within(dialog).getByRole("tab", { name: "Adres" }))
  return dialog
}

async function submit(dialog: HTMLElement, address: string, button: string) {
  const field = within(dialog).getByLabelText("Görselin ya da YouTube videosunun adresi")
  await userEvent.type(field, address)
  await userEvent.click(within(dialog).getByRole("button", { name: button }))
}

describe("looksLikeYoutube (a hint: the server decides)", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, true],
    [`https://youtu.be/${ID}`, true],
    [`https://m.youtube.com/shorts/${ID}`, true],
    [`https://www.youtube-nocookie.com/embed/${ID}`, true],
    [`youtu.be/${ID}`, true],
    ["https://cdn.ornek.com/gorsel.jpg", false],
    [`https://youtube.com.evil.com/watch?v=${ID}`, false],
    [`https://evilyoutube.com/watch?v=${ID}`, false],
    ["javascript:alert(1)//youtube.com", false],
    ["", false],
  ])("%s → %s", (address, expected) => {
    expect(looksLikeYoutube(address)).toBe(expected)
  })
})

/** adr/0069 §10, slice 5: a YouTube link through the same dialog's "Adres". */
describe("MediaCard with a YouTube link", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toastSuccess.mockReset()
    videos = []
    upload = true
    added = () => Promise.resolve({ video: video("mvid_new") })
    serve()
  })

  it("sends a YouTube link to the video route and closes the dialog", async () => {
    renderCard()
    const dialog = await addressTab()
    await submit(dialog, `https://youtu.be/${ID}?si=x`, "Videoyu ekle")
    await waitFor(() => {
      expect(calls("/admin/products/prod_1/videos/youtube")).toHaveLength(1)
    })
    expect(calls("/admin/products/prod_1/videos/youtube")[0]?.[1]).toEqual({
      method: "POST",
      body: { url: `https://youtu.be/${ID}?si=x` },
    })
    expect(calls("/admin/media/import")).toHaveLength(0)
    expect(toastSuccess).toHaveBeenCalledWith("YouTube videosu eklendi.")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("keeps sending any other address to the picture import", async () => {
    renderCard()
    const dialog = await addressTab()
    await submit(dialog, "https://cdn.ornek.com/yeni.jpg", "Kütüphaneye al ve seç")
    await waitFor(() => {
      expect(calls("/admin/media/import")).toHaveLength(1)
    })
    expect(calls("/admin/products/prod_1/videos/youtube")).toHaveLength(0)
  })

  it("shows the server's refusal under the field and keeps the dialog open", async () => {
    added = () =>
      Promise.reject(
        Object.assign(new Error("Bu video gömülemiyor ya da herkese açık değil."), {
          status: 400,
          message: "Bu video gömülemiyor ya da herkese açık değil.",
        })
      )
    renderCard()
    const dialog = await addressTab()
    await submit(dialog, `https://www.youtube.com/watch?v=${ID}`, "Videoyu ekle")
    expect(
      await within(dialog).findByText("Bu video gömülemiyor ya da herkese açık değil.")
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("refuses a link at two videos without asking the server", async () => {
    upload = false
    videos = [video("mvid_1"), video("mvid_2", { youtube_id: "a_B-c9_-Z0x" })]
    renderCard()
    expect(await screen.findByText("Bir ürüne en çok 2 video eklenebilir.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Görsel ekle: sürükleyin/ }))
    const dialog = await screen.findByRole("dialog", { name: "Görsel ekle" })
    await userEvent.click(within(dialog).getByRole("tab", { name: "Adres" }))
    await submit(dialog, `https://youtu.be/${ID}`, "Videoyu ekle")
    expect(
      await within(dialog).findByText("Bir ürüne en çok 2 video eklenebilir.")
    ).toBeInTheDocument()
    expect(calls("/admin/products/prod_1/videos/youtube")).toHaveLength(0)
  })

  it("takes a link where clips cannot be uploaded (no tools on the server)", async () => {
    upload = false
    renderCard()
    const dialog = await addressTab()
    await submit(dialog, `https://www.youtube.com/shorts/${ID}`, "Videoyu ekle")
    await waitFor(() => {
      expect(calls("/admin/products/prod_1/videos/youtube")).toHaveLength(1)
    })
  })

  it("opens a YouTube video's dialog: its link, YouTube'da aç, the title, no player and no empty facts", async () => {
    videos = [video("mvid_1")]
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Bileme rehberi" }))
    const dialog = await screen.findByRole("dialog", { name: "Video" })
    const link = within(dialog).getByLabelText("YouTube")
    expect(link).toHaveValue(`https://www.youtube.com/watch?v=${ID}`)
    expect(link).toHaveAttribute("readonly")
    const open = within(dialog).getByRole("link", { name: "YouTube'da aç" })
    expect(open).toHaveAttribute("href", `https://www.youtube.com/watch?v=${ID}`)
    expect(open).toHaveAttribute("target", "_blank")
    expect(open).toHaveAttribute("rel", "noopener noreferrer")
    expect(within(dialog).getByLabelText("Başlık")).toHaveValue("Bileme rehberi")
    expect(within(dialog).queryByText("Süre")).toBeNull()
    expect(within(dialog).queryByText("Boyut")).toBeNull()
    expect(dialog.querySelector("iframe, video")).toBeNull()
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("https://cdn/mvid_1.jpg")
    expect(within(dialog).getByRole("button", { name: "Videoyu kaldır" })).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Yeniden dene" })).toBeNull()
  })
})
