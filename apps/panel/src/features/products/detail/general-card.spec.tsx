import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { GeneralCard } from "./general-card"

const fetchMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { product: { update: updateMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const PRODUCT = {
  id: "prod_1",
  title: "Keten Gömlek",
  handle: "keten-gomlek",
  description: "Yazlık keten gömlek.",
} as unknown as ProductDetail

const CATALOG_URL = "/admin/products/prod_1/catalog"

/** The shop's URL style for the address prefix; the product's catalog fields with `summary`. */
function answers(summary: string[]) {
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === CATALOG_URL) {
      const body = init?.body as { summary?: string[] | null } | undefined
      return Promise.resolve({ summary: init?.method === "POST" ? (body?.summary ?? []) : summary })
    }
    return Promise.resolve({ values: { url_style: { product: "nested" } } })
  })
}

const catalogPosts = () =>
  fetchMock.mock.calls.filter(
    ([url, init]) => url === CATALOG_URL && (init as { method?: string } | undefined)?.method
  )

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GeneralCard product={PRODUCT} />
    </QueryClientProvider>
  )
}

describe("GeneralCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    updateMock.mockReset()
    answers(["Keten kumaş"])
  })

  // The form keeps dirty values when the product reloads; undo must not
  it("puts back what was saved on undo, in every field typed in", async () => {
    renderCard()
    const title = screen.getByRole("textbox", { name: /Ürün adı/ })
    const handle = screen.getByRole("textbox", { name: /Ürün adresi/ })
    const line = await screen.findByRole("textbox", { name: "1. madde" })

    await userEvent.type(title, " Beyaz")
    await userEvent.clear(handle)
    await userEvent.type(handle, "beyaz-gomlek")
    await userEvent.type(line, ", nefes alır")
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }))

    expect(title).toHaveValue("Keten Gömlek")
    expect(handle).toHaveValue("keten-gomlek")
    expect(line).toHaveValue("Keten kumaş")
  })

  // ADR-0055: the description is its own card, in the content editor
  it("leaves the description out, saving the name and address only", async () => {
    updateMock.mockResolvedValue({ product: { ...PRODUCT, title: "Keten Gömlek Beyaz" } })
    renderCard()
    expect(screen.queryByRole("textbox", { name: "Açıklama" })).toBeNull()
    await screen.findByRole("textbox", { name: "1. madde" })

    await userEvent.type(screen.getByRole("textbox", { name: /Ürün adı/ }), " Beyaz")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await vi.waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("prod_1", {
        title: "Keten Gömlek Beyaz",
        handle: "keten-gomlek",
      })
    })
    // The lines did not change: no catalog save
    expect(catalogPosts()).toEqual([])
  })

  it("saves changed lines through the catalog fields, the product left alone", async () => {
    renderCard()
    const first = await screen.findByRole("textbox", { name: "1. madde" })

    await userEvent.click(first)
    await userEvent.keyboard("{End}{Enter}")
    await userEvent.type(screen.getByRole("textbox", { name: "2. madde" }), "  Düğmeli   yaka ")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await vi.waitFor(() => {
      expect(catalogPosts()).toEqual([
        [CATALOG_URL, { method: "POST", body: { summary: ["Keten kumaş", "Düğmeli yaka"] } }],
      ])
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("clears the lines with null once every one is removed", async () => {
    renderCard()
    await screen.findByRole("textbox", { name: "1. madde" })

    await userEvent.click(screen.getByRole("button", { name: "1. maddeyi kaldır" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await vi.waitFor(() => {
      expect(catalogPosts()).toEqual([[CATALOG_URL, { method: "POST", body: { summary: null } }]])
    })
  })

  it("counts an empty row added and left as no change", async () => {
    renderCard()
    await screen.findByRole("textbox", { name: "1. madde" })

    await userEvent.click(screen.getByRole("button", { name: "Madde ekle" }))

    expect(screen.getByRole("textbox", { name: "2. madde" })).toHaveValue("")
    // The card's save row stays folded away (`CardForm`)
    expect(screen.getByRole("button", { name: "Kaydet" }).parentElement).toHaveClass("hidden")
  })
})
