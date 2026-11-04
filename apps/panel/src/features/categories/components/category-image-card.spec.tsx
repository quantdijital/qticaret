import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { asset } from "@/features/media/media.fixtures"
import { CategoryImageCard } from "./category-image-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { upload: { create: vi.fn() } } },
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
  })

  it("chooses a library image, takes its alt text and saves both", async () => {
    serve(null)
    renderCard()

    expect(await screen.findByText("Görsel yok")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Kategori görseli: görsel seç" }))
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

    await userEvent.click(
      await screen.findByRole("button", { name: "Kategori görseli: görseli kaldır" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, { method: "POST", body: { image: null } })
    })
  })
})
