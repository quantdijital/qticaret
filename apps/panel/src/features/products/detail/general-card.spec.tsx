import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { GeneralCard } from "./general-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
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
    const description = screen.getByRole("textbox", { name: "Açıklama" })

    await userEvent.type(title, " Beyaz")
    await userEvent.clear(description)
    await userEvent.type(description, "Yeni metin")
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }))

    expect(title).toHaveValue("Keten Gömlek")
    expect(description).toHaveValue("Yazlık keten gömlek.")
  })
})
