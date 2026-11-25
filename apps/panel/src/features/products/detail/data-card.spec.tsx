import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import type { PartKey } from "@/features/products/layout/parts"
import { DataCard } from "./data-card"
import { CATALOG, PRODUCT, answer } from "./product-fixtures"
import type { Answers } from "./product-fixtures"
import { PRODUCT_SECTIONS } from "./sections"
import { isSimpleProduct, useDataCard } from "./use-data-card"
import { usePartDraws } from "./use-part-draws"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

function Card({ product, hidden }: { product: ProductDetail; hidden: readonly PartKey[] }) {
  const state = useDataCard(product)
  const draws = usePartDraws(product.id)
  return (
    <DataCard
      product={product}
      state={state}
      slot={(key) => (hidden.includes(key) ? undefined : null)}
      draws={draws}
      marks={() => null}
    />
  )
}

function renderCard(
  answers: Answers = {},
  product: ProductDetail = PRODUCT,
  hidden: readonly PartKey[] = []
) {
  fetchMock.mockImplementation((url: string) => Promise.resolve(answer(url, answers)))
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Card product={product} hidden={hidden} />
    </QueryClientProvider>
  )
}

const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent)
const open = () => screen.getByRole("tabpanel")

const TWO_VARIANTS = {
  ...PRODUCT,
  options: [{ id: "opt_1", title: "Renk", values: [] }],
  variants: [
    ...(PRODUCT.variants ?? []),
    { id: "variant_2", title: "Mor", prices: [{ amount: 3100, currency_code: "try" }] },
  ],
} as unknown as ProductDetail

/** The owner, 2026-11-25: WooCommerce's product data box, one card with a type and vertical tabs. */
describe("DataCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("tells a simple product from one with variants", () => {
    expect(isSimpleProduct(PRODUCT)).toBe(true)
    expect(
      isSimpleProduct({
        ...PRODUCT,
        options: [{ title: "Default option" }],
      } as unknown as ProductDetail)
    ).toBe(true)
    expect(isSimpleProduct(TWO_VARIANTS)).toBe(false)
  })

  it("draws a simple product's tabs, Genel first, with no Varyantlar", async () => {
    renderCard()
    await waitFor(() => {
      expect(tabNames()).toEqual(["Genel", "Stok", "Kargo", "Özellikler", "Katalog", "Gelişmiş"])
    })
    expect(screen.getByRole("combobox", { name: "Ürün tipi" })).toHaveTextContent("Basit ürün")
    expect(screen.getByRole("tab", { name: "Genel" })).toHaveAttribute("aria-selected", "true")
  })

  it("keeps every panel drawn, shows the picked one and remembers it", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("tab", { name: "Kargo" }))
    const parcel = within(open()).getByRole("form", { name: "Paket ölçüleri" })
    expect(within(parcel).getByLabelText("Ağırlık")).toHaveValue("450")
    // The others stay drawn, hidden: an unsaved edit in them is kept
    expect(screen.getAllByRole("tabpanel", { hidden: true }).length).toBe(6)
    expect(Object.keys(localStorage).map((key) => localStorage.getItem(key))).toContain("shipping")
  })

  it("walks the tabs with the arrow keys, Home and End", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("tab", { name: "Genel" }))
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("tab", { name: "Stok" })).toHaveFocus()
    await user.keyboard("{End}")
    expect(screen.getByRole("tab", { name: "Gelişmiş" })).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Genel" })).toHaveFocus()
  })

  it("leaves out a tab the shop hid, and the parcel of a digital product", async () => {
    renderCard({ catalog: { ...CATALOG, kind: "digital" } }, PRODUCT, ["attributes"])
    await waitFor(() => {
      expect(screen.getByText("Dijital ürün: kargo yok")).toBeInTheDocument()
    })
    expect(tabNames()).toEqual(["Genel", "Stok", "Katalog", "Gelişmiş"])
  })

  it("says a refused measure in the Kargo tab, its save only once something changed", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("tab", { name: "Kargo" }))
    const form = within(open()).getByRole("form", { name: "Paket ölçüleri" })
    expect(within(form).getByRole("button", { name: "Kaydet" }).parentElement).toHaveClass("hidden")
    const weight = within(form).getByLabelText("Ağırlık")
    await user.clear(weight)
    await user.type(weight, "0")
    await user.click(within(form).getByRole("button", { name: "Kaydet" }))
    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Sıfırdan büyük bir sayı girin"
    )
  })

  it("has a product with variants keep its prices on them, and refuses to make it simple", async () => {
    const user = userEvent.setup()
    renderCard({}, TWO_VARIANTS)
    await waitFor(() => {
      expect(tabNames()).toContain("Varyantlar")
    })
    expect(screen.getByRole("combobox", { name: "Ürün tipi" })).toHaveTextContent("Varyantlı ürün")
    expect(screen.getByText(/basit ürüne dönmek için önce varyantları bire indirin/)).toBeVisible()
    expect(open()).toHaveTextContent("Fiyatlar her varyantta ayrı girilir.")
    await user.click(within(open()).getByRole("button", { name: "Varyantlara git" }))
    expect(screen.getByRole("tab", { name: "Varyantlar" })).toHaveAttribute("aria-selected", "true")
  })

  it("brings the Varyantlar tab once a simple product is made one with variants", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("combobox", { name: "Ürün tipi" }))
    await user.click(await screen.findByRole("option", { name: "Varyantlı ürün" }))
    expect(tabNames()).toContain("Varyantlar")
    expect(open()).toHaveTextContent("Fiyatlar her varyantta ayrı girilir.")
  })

  it("puts the caret in the parcel's weight on the advisor's jump (the page opens its tab)", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("tab", { name: "Kargo" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Ağırlık", { selector: "input" })).toBeInTheDocument()
    })
    act(() => {
      revealSection(PRODUCT_SECTIONS.shipping)
    })
    expect(screen.getByLabelText("Ağırlık", { selector: "input" })).toHaveFocus()
  })
})
