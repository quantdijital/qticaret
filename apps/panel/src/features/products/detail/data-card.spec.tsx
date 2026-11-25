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
import { isSimpleProduct, simplePlan } from "./simple-plan"
import { useDataCard } from "./use-data-card"
import { usePartDraws } from "./use-part-draws"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())
const batchVariants = vi.hoisted(() => vi.fn<(id: string, body: unknown) => Promise<unknown>>())
const linkOptions = vi.hoisted(() => vi.fn<(id: string, body: unknown) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { product: { batchVariants, linkOptions } } },
}))
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

// The wizard's option of a product without options, in the words the wizard writes it with
const WIZARD = { title: "Seçenek", value: "Standart" }

const TWO_VARIANTS = {
  ...PRODUCT,
  options: [
    {
      id: "opt_1",
      title: "Renk",
      values: [
        { id: "optval_1", value: "Sarı" },
        { id: "optval_2", value: "Mor" },
      ],
    },
  ],
  variants: [
    {
      id: "variant_1",
      title: "Sarı",
      prices: [{ amount: 3100, currency_code: "try" }],
      options: [{ option_id: "opt_1", value: "Sarı" }],
    },
    {
      id: "variant_2",
      title: "Mor",
      prices: [{ amount: 3400, currency_code: "try" }],
      options: [{ option_id: "opt_1", value: "Mor" }],
      manage_inventory: true,
      inventory_items: [{ inventory: { location_levels: [{ stocked_quantity: 4 }] } }],
    },
  ],
} as unknown as ProductDetail

// One variant, but a colour a shopper picks: not simple until its option goes
const ONE_COLOUR = {
  ...PRODUCT,
  options: [{ id: "opt_1", title: "Renk", values: [{ id: "optval_1", value: "Sarı" }] }],
} as unknown as ProductDetail

const pickSimple = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("combobox", { name: "Ürün tipi" }))
  await user.click(await screen.findByRole("option", { name: "Basit ürün" }))
}

/** The server calls in the order made: which batch, and its body. */
const calls = () =>
  [
    ...batchVariants.mock.calls.map((call, at) => ({
      order: batchVariants.mock.invocationCallOrder[at] ?? 0,
      call: ["variants", call[1]],
    })),
    ...linkOptions.mock.calls.map((call, at) => ({
      order: linkOptions.mock.invocationCallOrder[at] ?? 0,
      call: ["options", call[1]],
    })),
  ]
    .sort((a, b) => a.order - b.order)
    .map((each) => each.call)

const asking = () => screen.getByRole("group", { name: "Basit ürüne geçilsin mi?" })

/** The owner, 2026-11-25: WooCommerce's product data box, one card with a type and vertical tabs. */
describe("DataCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    batchVariants.mockReset().mockResolvedValue({})
    linkOptions.mockReset().mockResolvedValue({})
    localStorage.clear()
  })

  it("tells a simple product from one with variants", () => {
    expect(isSimpleProduct(PRODUCT, WIZARD)).toBe(true)
    expect(
      isSimpleProduct(
        { ...PRODUCT, options: [{ title: "Default option" }] } as unknown as ProductDetail,
        WIZARD
      )
    ).toBe(true)
    // The wizard's "Seçenek: Standart" is not a choice either
    expect(
      isSimpleProduct(
        {
          ...PRODUCT,
          options: [{ title: "Seçenek", values: [{ value: "Standart" }] }],
        } as unknown as ProductDetail,
        WIZARD
      )
    ).toBe(true)
    expect(isSimpleProduct(ONE_COLOUR, WIZARD)).toBe(false)
    expect(isSimpleProduct(TWO_VARIANTS, WIZARD)).toBe(false)
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

  it("has a product with variants keep its prices on them", async () => {
    const user = userEvent.setup()
    renderCard({}, TWO_VARIANTS)
    await waitFor(() => {
      expect(tabNames()).toContain("Varyantlar")
    })
    expect(screen.getByRole("combobox", { name: "Ürün tipi" })).toHaveTextContent("Varyantlı ürün")
    expect(open()).toHaveTextContent("Fiyatlar her varyantta ayrı girilir.")
    await user.click(within(open()).getByRole("button", { name: "Varyantlara git" }))
    expect(screen.getByRole("tab", { name: "Varyantlar" })).toHaveAttribute("aria-selected", "true")
  })

  it("asks in place before making a product of several variants simple; Vazgeç changes nothing", async () => {
    const user = userEvent.setup()
    renderCard({}, TWO_VARIANTS)
    await pickSimple(user)
    const ask = asking()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(ask).toHaveTextContent("diğer 1 varyant silinir")
    expect(ask).toHaveTextContent("Seçenekler (Renk) kaldırılır")
    // The first stays by default; the other's stock is said, not refused
    expect(within(ask).getAllByRole("radio")[0]).toBeChecked()
    expect(ask).toHaveTextContent("Silinecek 1 varyantın stoğu var (toplam 4 adet)")
    await user.click(within(ask).getByRole("button", { name: "Vazgeç" }))
    expect(screen.queryByRole("group", { name: "Basit ürüne geçilsin mi?" })).toBeNull()
    expect(screen.getByRole("combobox", { name: "Ürün tipi" })).toHaveTextContent("Varyantlı ürün")
    expect(batchVariants).not.toHaveBeenCalled()
    expect(linkOptions).not.toHaveBeenCalled()
  })

  it("deletes the variants not kept, then takes the options off", async () => {
    const user = userEvent.setup()
    renderCard({}, TWO_VARIANTS)
    await pickSimple(user)
    const ask = asking()
    await user.click(within(ask).getByRole("radio", { name: /Mor/ }))
    // Keeping the one in stock: nothing counted is deleted
    expect(ask).not.toHaveTextContent("stoğu var")
    await user.click(within(ask).getByRole("button", { name: "1 varyantı sil ve basit ürüne geç" }))
    await waitFor(() => {
      expect(linkOptions).toHaveBeenCalledTimes(2)
    })
    // Deleted, the placeholder added and given, the real option off last
    expect(calls()).toEqual([
      ["variants", { delete: ["variant_1"] }],
      ["options", { add: [{ title: "Seçenek", values: ["Standart"], is_exclusive: true }] }],
      [
        "variants",
        { update: [{ id: "variant_2", options: { Renk: "Mor", Seçenek: "Standart" } }] },
      ],
      ["options", { remove: ["opt_1"] }],
    ])
  })

  it("adds no second placeholder to a product that has one already", () => {
    const plan = simplePlan(
      {
        ...ONE_COLOUR,
        options: [
          ...(ONE_COLOUR.options ?? []),
          { id: "opt_std", title: "Seçenek", values: [{ id: "v", value: "Standart" }] },
        ],
      } as unknown as ProductDetail,
      "variant_1",
      WIZARD
    )
    expect(plan.add).toBeNull()
    expect(plan.values).toEqual({ Renk: "Sarı", Seçenek: "Standart" })
    expect(plan.options).toEqual(["opt_1"])
  })

  it("keeps the options when deleting the variants is refused, and says so in the card", async () => {
    const user = userEvent.setup()
    batchVariants.mockRejectedValue(new Error("refused"))
    renderCard({}, TWO_VARIANTS)
    await pickSimple(user)
    const ask = asking()
    await user.click(within(ask).getByRole("button", { name: "1 varyantı sil ve basit ürüne geç" }))
    expect(await within(ask).findByRole("alert")).toBeVisible()
    expect(linkOptions).not.toHaveBeenCalled()
  })

  it("takes the option off a product of one variant, its price and stock kept", async () => {
    const user = userEvent.setup()
    renderCard({}, ONE_COLOUR)
    expect(await screen.findByRole("combobox", { name: "Ürün tipi" })).toHaveTextContent(
      "Varyantlı ürün"
    )
    await pickSimple(user)
    const ask = asking()
    expect(ask).toHaveTextContent("Seçenekler (Renk) kaldırılır; fiyat, stok ve kodlar korunur.")
    expect(within(ask).queryByRole("radio")).toBeNull()
    await user.click(within(ask).getByRole("button", { name: "Basit ürüne geç" }))
    await waitFor(() => {
      expect(linkOptions).toHaveBeenCalledTimes(2)
    })
    // Nothing deleted; the variant ends on the wizard's "Seçenek: Standart"
    expect(calls()).toEqual([
      ["options", { add: [{ title: "Seçenek", values: ["Standart"], is_exclusive: true }] }],
      [
        "variants",
        { update: [{ id: "variant_1", options: { Renk: "Sarı", Seçenek: "Standart" } }] },
      ],
      ["options", { remove: ["opt_1"] }],
    ])
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
