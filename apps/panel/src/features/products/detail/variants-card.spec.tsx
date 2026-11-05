import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { revealSection } from "@/components/patterns/use-section-open"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { VARIANT_CODES_TARGET } from "./sections"
import { VariantsCard } from "./variants-card"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())
const batchVariants = vi.hoisted(() => vi.fn<(id: string, body: unknown) => Promise<unknown>>())
const batchVariantImages = vi.hoisted(() =>
  vi.fn<(id: string, variantId: string, body: unknown) => Promise<unknown>>()
)

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: {
      store: { list: () => Promise.resolve({ stores: [{ default_location_id: "sloc_1" }] }) },
      shippingProfile: { list: () => Promise.resolve({ shipping_profiles: [] }) },
      product: { batchVariants, batchVariantImages, update: vi.fn() },
      inventoryItem: { batchInventoryItemsLocationLevels: vi.fn() },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const variant = (
  id: string,
  value: string,
  codes: Record<string, string | null> = {},
  amount = 3100
) => ({
  id,
  title: value,
  variant_rank: Number(id.slice(-1)),
  manage_inventory: false,
  allow_backorder: false,
  sku: null,
  ean: null,
  upc: null,
  barcode: null,
  options: [{ value, option_id: "opt_color" }],
  ...codes,
  prices: [{ id: `price_${id}`, amount, currency_code: "try" }],
  inventory_items: [],
})

const PRODUCT = {
  id: "prod_1",
  title: "Yatağan Çakı",
  updated_at: "2026-11-05T09:00:00Z",
  options: [{ id: "opt_color", title: "Renk" }],
  images: [
    { id: "img_1", url: "https://cdn/1.jpg", rank: 0, variants: [] },
    { id: "img_2", url: "https://cdn/2.jpg", rank: 1, variants: [{ id: "variant_2" }] },
  ],
  media_assets: [
    { id: "media_2", url: "https://cdn/2.jpg", alt: "", file_id: "f2", derived_at: null },
  ],
  variants: [
    variant("variant_1", "Sarı", { sku: "MYL-1", ean: "8690000000005" }),
    variant("variant_2", "Pembe", { sku: "MYL-2", barcode: "RAF-25" }),
    variant("variant_3", "Mor", { sku: "MYL-3", ean: "8690000000005" }),
  ],
} as unknown as ProductDetail

const CATALOG = {
  variants: [
    { id: "variant_1", title: "Sarı", sku: "MYL-1", mpn: null, cost: null, gtin: "8690000000005" },
    { id: "variant_2", title: "Pembe", sku: "MYL-2", mpn: null, cost: null, gtin: null },
    { id: "variant_3", title: "Mor", sku: "MYL-3", mpn: "M-3", cost: null, gtin: null },
  ],
} as unknown as ProductCatalog

function answer(url: string): unknown {
  if (url === "/admin/features") {
    return { features: [] }
  }
  if (url.startsWith("/admin/platform-settings/")) {
    return { values: { weight_unit: "g", dimension_unit: "cm" } }
  }
  if (url.endsWith("/price-history")) {
    return { currency_code: "try", rule_version: "2025", window_days: 10, variants: [] }
  }
  return CATALOG
}

function renderCard(product: ProductDetail = PRODUCT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VariantsCard product={product} />
    </QueryClientProvider>
  )
}

/** The rows wait for the catalog (unit costs, MPNs): the dialog starts from them. */
async function row(name: RegExp) {
  const button = await screen.findByRole("button", { name })
  await waitFor(() => {
    expect(button).toBeEnabled()
  })
  return button
}

beforeEach(() => {
  fetchMock.mockReset()
  batchVariants.mockReset()
  batchVariantImages.mockReset()
  fetchMock.mockImplementation((url) => Promise.resolve(answer(url)))
  batchVariants.mockResolvedValue({})
  batchVariantImages.mockResolvedValue({})
})

/** The owner, 2026-11-05: "bu ürünü koyarsın, üzerine tıklarız, modal açılır, … düzenler, girer". */
describe("the variants card", () => {
  it("lists each variant as a row and opens its dialog on a click", async () => {
    const user = userEvent.setup()
    renderCard()
    const pembe = await row(/Renk: Pembe/)
    // Its stock code, price and what it lacks, in the row
    expect(pembe).toHaveTextContent("MYL-2")
    expect(pembe).toHaveTextContent("3.100,00")
    expect(pembe).toHaveTextContent("Barkod yok")

    await user.click(pembe)
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    expect(dialog).toHaveAccessibleDescription("Renk: Pembe · MYL-2")
    expect(within(dialog).getByLabelText("Satış fiyatı")).toHaveValue("3.100,00")
    expect(within(dialog).getByText("2 / 3")).toBeInTheDocument()
    // The size scale's `lg`, its body scrolling between a fixed header and footer
    expect(dialog).toHaveAttribute("data-size", "lg")
    expect(dialog).toHaveAttribute("data-pane")
  })

  it("walks to the next variant, asking before an unsaved change is lost", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Sarı/))
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })

    await user.click(within(dialog).getByRole("button", { name: "Sonraki varyant" }))
    expect(dialog).toHaveAccessibleDescription("Renk: Pembe · MYL-2")
    expect(within(dialog).getByRole("button", { name: "Önceki varyant" })).toBeEnabled()

    const price = within(dialog).getByLabelText("Satış fiyatı")
    await user.clear(price)
    await user.type(price, "2.900")
    await user.click(within(dialog).getByRole("button", { name: "Sonraki varyant" }))
    const ask = screen.getByRole("alertdialog", { name: "Kaydedilmemiş değişiklikler atılsın mı?" })
    await user.click(within(ask).getByRole("button", { name: "Değişiklikleri at" }))

    expect(dialog).toHaveAccessibleDescription("Renk: Mor · MYL-3")
    expect(within(dialog).getByLabelText("Satış fiyatı")).toHaveValue("3.100,00")
    expect(within(dialog).getByRole("button", { name: "Sonraki varyant" })).toBeDisabled()
    expect(batchVariants).not.toHaveBeenCalled()
  })

  it("gives the price to every variant when asked", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Sarı/))
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    const price = within(dialog).getByLabelText("Satış fiyatı")
    await user.clear(price)
    await user.type(price, "2.900")
    await user.click(within(dialog).getByRole("checkbox", { name: /diğer 2 varyanta da uygula/ }))
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(batchVariants).toHaveBeenCalledWith("prod_1", {
        update: ["variant_1", "variant_2", "variant_3"].map((id) => ({
          id,
          prices: [{ id: `price_${id}`, currency_code: "try", amount: 2900 }],
        })),
      })
    })
    // Saved, it closes
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("opens the first variant without a barcode on its codes for the advisor's jump", async () => {
    renderCard()
    await row(/Renk: Pembe/)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog")
    })

    act(() => {
      revealSection(VARIANT_CODES_TARGET)
    })

    const dialog = await screen.findByRole("dialog", { name: "Varyantı düzenle" })
    expect(dialog).toHaveAccessibleDescription("Renk: Pembe · MYL-2")
    expect(within(dialog).getByRole("tab", { name: "Kodlar ve ölçüler" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    const barcode = within(dialog).getByLabelText("Barkod (GTIN)")
    await waitFor(() => {
      expect(barcode).toHaveFocus()
    })
    // The in-house code in `barcode` is not shown as a GTIN
    expect(barcode).toHaveValue("")
  })

  it("refuses a mistyped barcode next to its field, back on its tab, and sends nothing", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Pembe/))
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    await user.click(within(dialog).getByRole("tab", { name: "Kodlar ve ölçüler" }))
    await user.type(within(dialog).getByLabelText("Barkod (GTIN)"), "8690000000001")
    await user.click(within(dialog).getByRole("tab", { name: "Fiyat ve stok" }))
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Barkodun son rakamı tutmuyor"
    )
    expect(within(dialog).getByLabelText("Barkod (GTIN)")).toHaveFocus()
    expect(batchVariants).not.toHaveBeenCalled()
  })

  it("saves the barcode to the EAN and the MPN to the catalog, leaving the in-house code alone", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Pembe/))
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    await user.click(within(dialog).getByRole("tab", { name: "Kodlar ve ölçüler" }))
    await user.type(within(dialog).getByLabelText("Barkod (GTIN)"), "4006381333931")
    await user.type(within(dialog).getByLabelText("Üretici kodu (MPN)"), "RAF-25-ST")
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(batchVariants).toHaveBeenCalledWith("prod_1", {
        update: [{ id: "variant_2", ean: "4006381333931" }],
      })
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
      method: "POST",
      body: { variants: { variant_2: { mpn: "RAF-25-ST" } } },
    })
  })

  it("ties pictures to the variant and saves their alt texts, from the dialog", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Pembe/))
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    await user.click(within(dialog).getByRole("tab", { name: "Görseller (1)" }))

    // Its own picture, described here
    await user.type(within(dialog).getByLabelText("1. görsel"), "Pembe kabzalı çakı, önden")
    // The product's other picture shows with every variant until one is tied to it
    const shared = within(dialog).getByRole("button", {
      name: "1. görsel: Tüm varyantlarda görünür",
    })
    expect(shared).toHaveAttribute("aria-pressed", "false")
    await user.click(shared)
    expect(within(dialog).getByRole("tab", { name: "Görseller (2)" })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(batchVariantImages).toHaveBeenCalledWith("prod_1", "variant_2", {
        add: ["img_1"],
        remove: [],
      })
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/media/media_2", {
      method: "POST",
      body: { alt: "Pembe kabzalı çakı, önden" },
    })
    // Nothing of the variant's own fields changed
    expect(batchVariants).not.toHaveBeenCalled()
  })

  it("points out a stored code that is not a GTIN, letting it through", async () => {
    const user = userEvent.setup()
    renderCard({
      ...PRODUCT,
      variants: [
        variant("variant_1", "Sarı", { ean: "4006381333932" }),
        variant("variant_2", "Pembe"),
      ],
    } as unknown as ProductDetail)
    await user.click(await row(/Renk: Sarı/))
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    await user.click(within(dialog).getByRole("tab", { name: "Kodlar ve ölçüler" }))

    expect(within(dialog).getByText(/Google bu barkodu kullanmaz/)).toBeInTheDocument()
    expect(within(dialog).queryByRole("alert")).toBeNull()
  })
})

describe("a product of one variant", () => {
  it("has its price, stock and codes in the card, saved there", async () => {
    const user = userEvent.setup()
    renderCard({
      ...PRODUCT,
      variants: [variant("variant_1", "Varsayılan", { sku: "MYL-1" })],
    } as unknown as ProductDetail)
    expect(await screen.findByRole("heading", { name: "Fiyat, stok ve kodlar" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /Varsayılan/ })).toBeNull()

    const price = screen.getByLabelText("Satış fiyatı")
    await waitFor(() => {
      expect(price).toHaveValue("3.100,00")
    })
    await user.clear(price)
    await user.type(price, "3.250")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(batchVariants).toHaveBeenCalledWith("prod_1", {
        update: [
          {
            id: "variant_1",
            prices: [{ id: "price_variant_1", currency_code: "try", amount: 3250 }],
          },
        ],
      })
    })
  })
})
