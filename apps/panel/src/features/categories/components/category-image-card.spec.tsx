import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { asset } from "@/features/media/media.fixtures"
import { CategoryImageCard } from "./category-image-card"

const fetchMock = vi.hoisted(() => vi.fn())
const productList = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: {
      upload: { create: vi.fn() },
      productCategory: {
        list: () =>
          Promise.resolve({
            product_categories: [
              { id: "pcat_1", name: "Mutfak", parent_category_id: null },
              { id: "pcat_2", name: "Şef bıçakları", parent_category_id: "pcat_1" },
              { id: "pcat_3", name: "Kamp", parent_category_id: null },
            ],
          }),
      },
      product: { list: productList },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const URL = "/admin/category-images/pcat_1"
const CHOSEN = asset("media_1", { filename: "mutfak.webp", alt: "Tezgâh üstü" })

interface Init {
  method?: string
  body?: { image: { url: string; alt: string | null } | null }
}

/** The category's saved picture; a save answered with what was sent. */
function serve(saved: { url: string; alt: string | null } | null) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/media") {
      return Promise.resolve({ media: [CHOSEN], count: 1 })
    }
    if (init?.method === "POST") {
      const image = init.body?.image ?? null
      return Promise.resolve({ image: image ? { category_id: "pcat_1", ...image } : null })
    }
    return Promise.resolve({
      images: saved ? [{ category_id: "pcat_1", ...saved }] : [],
    })
  })
}

/** The newest published product under the category, as the storefront would pick it. */
function newest(
  product: {
    title: string
    thumbnail: string | null
    images: { url: string; rank: number }[]
  } | null
) {
  productList.mockResolvedValue({ products: product ? [{ id: "prod_1", ...product }] : [] })
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CategoryImageCard categoryId="pcat_1" />
    </QueryClientProvider>
  )
}

describe("CategoryImageCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    productList.mockReset()
    newest(null)
  })

  it("shows beside the empty frame the newest product photo the storefront uses", async () => {
    serve(null)
    newest({
      title: "Şef bıçağı 20 cm",
      thumbnail: "https://cdn.example.com/kapak.webp",
      images: [
        { url: "https://cdn.example.com/ikinci.webp", rank: 1 },
        { url: "https://cdn.example.com/ilk.webp", rank: 0 },
      ],
    })
    const { container } = renderCard()

    expect(
      await screen.findByText("Vitrinde şu an: en yeni ürünün fotoğrafı (Şef bıçağı 20 cm)")
    ).toBeInTheDocument()
    expect(container.querySelector('img[src="https://cdn.example.com/ilk.webp"]')).toHaveClass(
      "aspect-[4/5]"
    )
    expect(screen.getByText(/4:5 dikey kırpılır/)).toBeInTheDocument()
    // The category and the ones under it, published, newest first
    expect(productList).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: ["pcat_1", "pcat_2"],
        status: ["published"],
        limit: 1,
        order: "-created_at",
      })
    )
  })

  it("says only the name shows when no product has a photo", async () => {
    serve(null)
    renderCard()

    expect(
      await screen.findByText("Vitrinde şu an yalnız kategori adı görünüyor; bir görsel ekleyin.")
    ).toBeInTheDocument()
    expect(screen.getByText("Mutfak")).toBeInTheDocument()
  })

  it("chooses a library image, takes its alt text and saves both", async () => {
    serve(null)
    renderCard()

    const frame = await screen.findByRole("button", { name: "Kategori görseli: görsel seç" })
    // The empty frame is the standard way in, in the storefront tile's 4:5
    expect(frame).toHaveTextContent("Görsel ekle")
    expect(frame).toHaveClass("aspect-[4/5]")
    expect(
      screen.getByText(/Görsel seçmezseniz kategorideki en yeni ürünün fotoğrafı kullanılır/)
    ).toBeInTheDocument()
    await userEvent.click(frame)
    const picker = await screen.findByRole("dialog")
    await userEvent.click(await within(picker).findByRole("button", { name: "mutfak.webp" }))
    await userEvent.click(within(picker).getByRole("button", { name: "Seç" }))

    expect(screen.getByRole("textbox", { name: "Alt metin" })).toHaveValue("Tezgâh üstü")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { image: { url: CHOSEN.url, alt: "Tezgâh üstü" } },
      })
    })
  })

  it("takes the picture off with null", async () => {
    serve({ url: "https://cdn.example.com/eski.webp", alt: "Eski" })
    renderCard()

    expect(
      await screen.findByRole("button", { name: "Kategori görseli: görseli değiştir" })
    ).toHaveTextContent("Değiştir")
    expect(screen.getByRole("textbox", { name: "Alt metin" })).toHaveValue("Eski")
    // With its own picture the storefront's fallback is not shown
    expect(screen.queryByText(/Vitrinde şu an/)).not.toBeInTheDocument()
    await userEvent.click(
      await screen.findByRole("button", { name: "Kategori görseli: görseli kaldır" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, { method: "POST", body: { image: null } })
    })
    expect(
      await screen.findByRole("button", { name: "Kategori görseli: görsel seç" })
    ).toHaveTextContent("Görsel ekle")
  })
})
