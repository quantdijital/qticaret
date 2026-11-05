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

describe("GeneralCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // The shop's URL style, for the address prefix
    fetchMock.mockResolvedValue({ values: { url_style: { product: "nested" } } })
  })

  // The form keeps dirty values when the product reloads; undo must not
  it("puts back what was saved on undo, in every field typed in", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <GeneralCard product={PRODUCT} />
      </QueryClientProvider>
    )
    const title = screen.getByRole("textbox", { name: /Ürün adı/ })
    const handle = screen.getByRole("textbox", { name: /Ürün adresi/ })

    await userEvent.type(title, " Beyaz")
    await userEvent.clear(handle)
    await userEvent.type(handle, "beyaz-gomlek")
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }))

    expect(title).toHaveValue("Keten Gömlek")
    expect(handle).toHaveValue("keten-gomlek")
  })

  // ADR-0055: the description is its own card, in the content editor
  it("leaves the description out, saving the name and address only", async () => {
    updateMock.mockResolvedValue({ product: { ...PRODUCT, title: "Keten Gömlek Beyaz" } })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <GeneralCard product={PRODUCT} />
      </QueryClientProvider>
    )
    expect(screen.queryByRole("textbox", { name: "Açıklama" })).toBeNull()

    await userEvent.type(screen.getByRole("textbox", { name: /Ürün adı/ }), " Beyaz")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await vi.waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("prod_1", {
        title: "Keten Gömlek Beyaz",
        handle: "keten-gomlek",
      })
    })
  })
})
