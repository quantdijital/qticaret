import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { MediaDetail } from "@/features/media/api/media"
import { asset, detail } from "@/features/media/media.fixtures"
import { MediaPage } from "./media-page"

const fetchMock = vi.hoisted(() => vi.fn())
const uploadMock = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => ({ value: {} }))

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { upload: { create: uploadMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/products">{children}</a>,
  getRouteApi: () => ({ useSearch: () => search.value }),
  useNavigate: () => vi.fn(),
}))

const LIST = [
  asset("media_1", { filename: "vitrin-kapak.webp" }),
  asset("media_2", { filename: "logo.png", mime_type: "image/png", width: 400, height: 400 }),
]

function serve(details: Record<string, MediaDetail>) {
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    // The alt text's AI button (alt-text-ai.spec.tsx): no task usable here
    if (url === "/admin/ai/services") {
      return Promise.resolve({ services: [], tasks: [], flags: { own_keys: true } })
    }
    if (url === "/admin/media") {
      return Promise.resolve(
        init?.method === "POST"
          ? { media: [asset("media_new", { filename: "yeni.png" })] }
          : { media: LIST, count: LIST.length }
      )
    }
    const id = url.split("/").pop() ?? ""
    if (init?.method === "DELETE") {
      return Promise.resolve({ id, deleted: true })
    }
    if (init?.method === "POST") {
      return Promise.resolve({ media: { id, ...(init.body as object) } })
    }
    return Promise.resolve({ media: details[id] })
  })
}

function renderPage(canWrite = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(STAFF_KEY, { user_id: "user_1", role: "owner", can: { catalog: canWrite } })
  return render(
    <QueryClientProvider client={client}>
      <MediaPage />
    </QueryClientProvider>
  )
}

describe("MediaPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    uploadMock.mockReset()
    search.value = {}
    serve({
      media_1: detail("media_1", {
        filename: "vitrin-kapak.webp",
        usage: [{ kind: "product", id: "prod_1", label: "Masa Lambası" }],
      }),
      media_2: detail("media_2", { filename: "logo.png" }),
    })
  })

  it("shows the library as thumbnails with each file's name, type, size and bytes", async () => {
    renderPage()

    expect(await screen.findByRole("button", { name: "vitrin-kapak.webp" })).toBeInTheDocument()
    expect(screen.getByText("WEBP · 1200 × 800 · 240 KB")).toBeInTheDocument()
    expect(screen.getByText("PNG · 400 × 400 · 240 KB")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/media", {
      query: { offset: 0, limit: 24 },
    })
  })

  it("searches the library from the address and says when nothing matches", async () => {
    search.value = { q: "yok" }
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/ai/services"
          ? { services: [], tasks: [], flags: { own_keys: true } }
          : { media: [], count: 0 }
      )
    )
    renderPage()

    expect(await screen.findByText("Aramaya uyan görsel yok.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/media", {
      query: { offset: 0, limit: 24, q: "yok" },
    })
  })

  it("opens an image's detail with where it is used, and keeps an image in use from deletion", async () => {
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "vitrin-kapak.webp" }))
    const sheet = await screen.findByRole("dialog")

    expect(await within(sheet).findByText("Masa Lambası")).toBeInTheDocument()
    expect(within(sheet).getByText("Ürün görseli")).toBeInTheDocument()
    expect(within(sheet).getByText("Ayşe Yılmaz")).toBeInTheDocument()
    expect(within(sheet).getByRole("button", { name: "Görseli sil" })).toBeDisabled()
    expect(within(sheet).getByText("Kullanılan görsel silinemez.")).toBeInTheDocument()
  })

  it("renames an image and gives it an alt text in one save", async () => {
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "logo.png" }))
    const sheet = await screen.findByRole("dialog")
    const name = await within(sheet).findByRole("textbox", { name: "Dosya adı" })

    await userEvent.clear(name)
    await userEvent.type(name, "Mağaza logosu")
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Alt metin" }), "Logo")
    await userEvent.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/media/media_2", {
        method: "POST",
        body: { filename: "Mağaza logosu", alt: "Logo" },
      })
    })
  })

  it("deletes an unused image after asking", async () => {
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "logo.png" }))
    const sheet = await screen.findByRole("dialog")
    await userEvent.click(await within(sheet).findByRole("button", { name: "Görseli sil" }))
    const confirm = await screen.findByRole("alertdialog")

    expect(within(confirm).getByText(/“logo.png” ve dosyaları kalıcı olarak silinir/)).toBeVisible()
    await userEvent.click(within(confirm).getByRole("button", { name: "Görseli sil" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/media/media_2", { method: "DELETE" })
    })
  })

  it("uploads several files with their progress, and hides uploading from a reader", async () => {
    uploadMock.mockResolvedValue({ files: [{ id: "yeni.png", url: "https://cdn/yeni.png" }] })
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Görsel yükle" }))
    const dialog = await screen.findByRole("dialog")
    const files = [
      new File(["a"], "bir.png", { type: "image/png" }),
      new File(["b"], "iki.gif", { type: "image/gif" }),
    ]

    await userEvent.upload(within(dialog).getByLabelText("Bilgisayardan görsel seç"), files, {
      applyAccept: false,
    })

    expect(await within(dialog).findByText("Eklendi")).toBeInTheDocument()
    expect(within(dialog).getByText("Bu dosya türü yüklenemez")).toBeInTheDocument()
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument()
    expect(uploadMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/admin/media", {
      method: "POST",
      body: { file_ids: ["yeni.png"], library: true },
    })
  })

  it("offers no upload to a role that may not write the catalog", async () => {
    renderPage(false)

    expect(await screen.findByRole("button", { name: "logo.png" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Görsel yükle" })).not.toBeInTheDocument()
  })

  it("offers the alt text suggestions only to a role the task allows", async () => {
    const { unmount } = renderPage()
    expect(await screen.findByRole("button", { name: "logo.png" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Alt metin önerileri" })).not.toBeInTheDocument()
    unmount()

    const base = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url: string, init?: unknown) =>
      url === "/admin/ai/services"
        ? Promise.resolve({
            services: [],
            tasks: [{ id: "image_alt_text", allowed: true, usable: [], options: [] }],
            flags: { own_keys: true },
          })
        : (base?.(url, init) as Promise<unknown>)
    )
    renderPage()
    expect(await screen.findByRole("button", { name: "Alt metin önerileri" })).toBeInTheDocument()
  })
})
