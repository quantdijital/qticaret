import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import type { ProductVideo } from "@/features/products/api/videos"
import { MediaCard } from "./media-card"

const fetchMock = vi.hoisted(() => vi.fn())
const uploadMock = vi.hoisted(() => vi.fn())
const videoUpload = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { upload: { create: uploadMock }, product: { update: vi.fn() } },
  },
}))
vi.mock("@/features/products/api/video-upload", () => ({ uploadProductVideo: videoUpload }))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn(), warning: vi.fn() },
}))

const PRODUCT = {
  id: "prod_1",
  images: [
    { id: "img_1", url: "https://cdn/on.jpg", rank: 0 },
    { id: "img_2", url: "https://cdn/arka.jpg", rank: 1 },
  ],
  media_assets: [],
} as unknown as ProductDetail

const clip = (id: string, fields: Partial<ProductVideo> = {}): ProductVideo => ({
  id,
  kind: "upload",
  status: "ready",
  title: null,
  position: 1,
  width: 720,
  height: 1280,
  duration_ms: 12_000,
  outputs: { mp4: { url: `https://cdn/${id}.mp4`, bytes: 1 } },
  poster: { url: `https://cdn/${id}.jpg`, width: 720, height: 1280 },
  youtube_id: null,
  error_code: null,
  retryable: false,
  created_at: "2026-11-17T10:00:00Z",
  ...fields,
})

let flag = true
let videos: ProductVideo[] = []
let upload = true

function serve() {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/admin/features") {
      return Promise.resolve({
        features: [{ key: "catalog.product_videos", owner: "platform", enabled: flag }],
      })
    }
    if (url === "/admin/products/prod_1/videos") {
      return Promise.resolve({ videos, limit: 2, upload })
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

const videoRequests = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes("/videos")).length

const drop = (target: HTMLElement, files: File[]) => {
  fireEvent.drop(target, { dataTransfer: { files, types: ["Files"] } })
}

/** adr/0069 §10: "Görseller ve videolar", one way in for both. */
describe("MediaCard with product videos", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    uploadMock.mockReset()
    videoUpload.mockReset()
    toastError.mockReset()
    flag = true
    videos = []
    upload = true
    serve()
  })

  it("is the old pictures-only card while the flag is off, and asks for no videos", async () => {
    flag = false
    renderCard()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/features")
    })
    expect(await screen.findByText("Görseller")).toBeInTheDocument()
    expect(screen.queryByText("Görseller ve videolar")).toBeNull()
    expect(videoRequests()).toBe(0)
  })

  it("puts the videos right after the first picture, labelled by state", async () => {
    videos = [
      clip("mvid_1", { status: "processing", poster: null }),
      clip("mvid_2", { status: "failed", error_code: "video.unreadable", poster: null }),
    ]
    renderCard()
    expect(await screen.findByText("Görseller ve videolar")).toBeInTheDocument()
    const tiles = await screen.findAllByRole("listitem")
    const names = tiles.map((tile) =>
      within(tile).queryByRole("button")?.getAttribute("aria-label")
    )
    expect(names[0]).toMatch(/^1\. görsel/)
    expect(names[1]).toBe("1. video, İşleniyor")
    expect(names[2]).toBe("2. video, İşlenemedi")
    expect(names[3]).toMatch(/^2\. görsel/)
    // A video tile is never dragged (it cannot become the first)
    expect(tiles[1]?.getAttribute("draggable")).toBeNull()
  })

  it("writes nothing on a ready video's tile", async () => {
    videos = [clip("mvid_1", { title: "Yakın çekim" })]
    renderCard()
    const tile = await screen.findByRole("button", { name: "Yakın çekim" })
    expect(within(tile).queryByText("İşleniyor")).toBeNull()
    expect(within(tile).queryByText("İşlenemedi")).toBeNull()
  })

  it("sends a dropped clip to the video route and a picture to the image route", async () => {
    videoUpload.mockResolvedValue(clip("mvid_new", { status: "uploaded" }))
    uploadMock.mockResolvedValue({ files: [{ id: "file_1", url: "https://cdn/yeni.png" }] })
    renderCard()
    const zone = await screen.findByRole("button", { name: /Görsel ya da video ekle/ })
    const mp4 = new File(["v"], "klip.mp4", { type: "video/mp4" })
    const png = new File(["p"], "yeni.png", { type: "image/png" })
    drop(zone, [mp4, png])
    await waitFor(() => {
      expect(videoUpload).toHaveBeenCalledTimes(1)
    })
    expect(videoUpload.mock.calls[0]?.[0]).toBe("prod_1")
    expect(videoUpload.mock.calls[0]?.[1]).toBe(mp4)
    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith({ files: [png] })
    })
  })

  it("refuses a third video with the reason, offering the upload no more", async () => {
    videos = [clip("mvid_1"), clip("mvid_2")]
    renderCard()
    expect(await screen.findByText("Bir ürüne en çok 2 video eklenebilir.")).toBeInTheDocument()
    const zone = screen.getByRole("button", { name: /Görsel ekle: sürükleyin/ })
    drop(zone, [new File(["v"], "klip.mp4", { type: "video/mp4" })])
    expect(toastError).toHaveBeenCalledWith("Bir ürüne en çok 2 video eklenebilir.")
    expect(videoUpload).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it("offers no video upload where the server cannot take one, and says nothing of why", async () => {
    upload = false
    videos = [clip("mvid_1")]
    renderCard()
    // The videos still show; the zone and its dialog take pictures alone
    expect(await screen.findByRole("button", { name: "1. video" })).toBeInTheDocument()
    const zone = screen.getByRole("button", { name: /Görsel ekle: sürükleyin/ })
    await userEvent.click(zone)
    const dialog = await screen.findByRole("dialog", { name: "Görsel ekle" })
    await userEvent.click(within(dialog).getByRole("tab", { name: "Bilgisayardan yükle" }))
    const input = within(dialog).getByLabelText("Bilgisayardan görsel seç")
    expect(input.getAttribute("accept")).not.toMatch(/video/)
    expect(screen.queryByText(/yüklenemiyor/)).toBeNull()
  })

  it("opens the Video dialog from a tile; Yeniden dene only for the infrastructure's failure", async () => {
    videos = [
      clip("mvid_1", {
        status: "failed",
        error_code: "video.processing_failed",
        retryable: true,
        poster: null,
        outputs: null,
      }),
      clip("mvid_2", { status: "failed", error_code: "video.too_long", poster: null }),
    ]
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "1. video, İşlenemedi" }))
    let dialog = await screen.findByRole("dialog", { name: "Video" })
    expect(
      within(dialog).getByText(
        "Video hazırlanamadı. Yeniden deneyin; olmazsa başka bir dosya yükleyin."
      )
    ).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Yeniden dene" })).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Videoyu kaldır" })).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Başlık")).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")
    await userEvent.click(await screen.findByRole("button", { name: "2. video, İşlenemedi" }))
    dialog = await screen.findByRole("dialog", { name: "Video" })
    expect(within(dialog).getByText("Video en çok 30 saniye olabilir.")).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Yeniden dene" })).toBeNull()
  })
})
