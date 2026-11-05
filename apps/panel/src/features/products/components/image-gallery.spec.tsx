import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { asset } from "@/features/media/media.fixtures"
import { ImageGallery } from "./image-gallery"
import type { GalleryImage } from "./image-gallery"

const fetchMock = vi.hoisted(() => vi.fn())
const uploadMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { upload: { create: uploadMock } } },
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

const tile = (key: string, alt: string): GalleryImage => ({
  key,
  url: `https://cdn/${key}.jpg`,
  alt: { value: alt, legacy: false, versions: "ready" },
})

function renderGallery(images: GalleryImage[] = [tile("1", "Önden"), tile("2", "")]) {
  const handlers = {
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onMakeMain: vi.fn(),
    onMove: vi.fn(),
    onAlt: vi.fn(),
  }
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ImageGallery images={images} {...handlers} />
    </QueryClientProvider>
  )
  return handlers
}

const LIBRARY = [asset("media_1", { filename: "kapak.webp" })]

/** The owner, 2026-11-05: "'görselleri sürükle' yazdığın box'a tıkladığım an o modal açılsa". */
describe("ImageGallery", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    uploadMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
      Promise.resolve(
        url === "/admin/media" && init?.method === "POST"
          ? { media: [{ id: "media_up", url: "https://cdn/yeni.png" }] }
          : { media: LIBRARY, count: 1 }
      )
    )
  })

  it("opens the media dialog from the drop zone; no second button beside it", async () => {
    const { onAdd } = renderGallery([])
    expect(screen.queryByRole("button", { name: /Kütüphaneden seç/ })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: /Görsel ekle: sürükleyin/ }))
    const dialog = await screen.findByRole("dialog", { name: "Görsel ekle" })
    // Upload and library in the one dialog
    expect(within(dialog).getByRole("tab", { name: "Bilgisayardan yükle" })).toBeInTheDocument()
    await userEvent.click(await within(dialog).findByRole("button", { name: "kapak.webp" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Seç" }))

    expect(onAdd).toHaveBeenCalledWith([{ id: LIBRARY[0]?.file_id, url: LIBRARY[0]?.url }])
  })

  it("uploads files dropped on the zone at once, without the dialog", async () => {
    uploadMock.mockResolvedValue({ files: [{ id: "file_1", url: "https://cdn/raw.png" }] })
    const { onAdd } = renderGallery()
    const zone = screen.getByRole("button", { name: /Görsel ekle: sürükleyin/ })

    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File(["a"], "yeni.png", { type: "image/png" })],
        types: ["Files"],
      },
    })

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith([{ id: "file_1", url: "https://cdn/yeni.png" }])
    })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("edits a picture's alt text from its tile, and says which have none", async () => {
    const { onAlt } = renderGallery()
    expect(screen.getByText("1 görselin alt metni eksik")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "2. görsel: Alt metin yok" }))
    const field = screen.getByLabelText("2. görsel")
    await userEvent.type(field, "Yandan görünüm{Enter}")

    expect(onAlt).toHaveBeenCalledWith(1, "Yandan görünüm")
  })

  it("moves, makes main and removes a picture from its tile, the keyboard's way to drag", async () => {
    const { onMove, onMakeMain, onRemove } = renderGallery()
    await userEvent.click(screen.getByRole("button", { name: "1. görsel, Ana görsel: Önden" }))
    expect(screen.getByRole("button", { name: "Öne al" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Geriye al" }))
    expect(onMove).toHaveBeenCalledWith(0, 1)

    await userEvent.keyboard("{Escape}")
    await userEvent.click(screen.getByRole("button", { name: "2. görsel: Alt metin yok" }))
    await userEvent.click(screen.getByRole("button", { name: "Ana görsel yap" }))
    expect(onMakeMain).toHaveBeenCalledWith(1)

    await userEvent.click(screen.getByRole("button", { name: "2. görsel: Alt metin yok" }))
    await userEvent.click(screen.getByRole("button", { name: "Görseli kaldır" }))
    expect(onRemove).toHaveBeenCalledWith(1)
  })
})
