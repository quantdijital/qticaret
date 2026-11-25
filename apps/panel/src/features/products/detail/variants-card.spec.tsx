import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import { DirtyRegistryProvider, useDirtyRegistry } from "@qticaret/admin-ui/patterns/dirty-registry"
import type { ProductDetail } from "@/features/products/api/products"
import { VARIANT_CODES_TARGET } from "./sections"
import { VariantsCard } from "./variants-card"
import { answer, PRODUCT, variant } from "./variants-card.fixture"

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
      product: { batchVariants, batchVariantImages, update: vi.fn(), linkOptions: vi.fn() },
      inventoryItem: { batchInventoryItemsLocationLevels: vi.fn() },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

/** The page's save bar, as far as the card is concerned: its count and its "Kaydet". */
function BarProbe() {
  const registry = useDirtyRegistry()
  return (
    <button type="button" onClick={() => registry?.submitAll()}>
      {`Bar: ${String(registry?.now.dirty ?? 0)}`}
    </button>
  )
}

function renderCard(product: ProductDetail = PRODUCT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DirtyRegistryProvider>
        <VariantsCard product={product} />
        <BarProbe />
      </DirtyRegistryProvider>
    </QueryClientProvider>
  )
}

/** The rows wait for the catalog (unit costs, MPNs): the form starts from them. */
async function row(name: RegExp) {
  const button = await screen.findByRole("button", { name })
  await waitFor(() => {
    expect(button).toBeEnabled()
  })
  return button
}

const form = () => screen.getByRole("form", { name: "Varyantı düzenle" })

beforeEach(() => {
  fetchMock.mockReset()
  batchVariants.mockReset()
  batchVariantImages.mockReset()
  fetchMock.mockImplementation((url) => Promise.resolve(answer(url)))
  batchVariants.mockResolvedValue({})
  batchVariantImages.mockResolvedValue({})
})

/** The owner, 2026-11-25: WooCommerce's variations, each row opening in place, no dialog. */
describe("the variants card", () => {
  it("lists each variant as a row and opens its form in place on a click", async () => {
    const user = userEvent.setup()
    renderCard()
    const pembe = await row(/Renk: Pembe/)
    // Its stock code, price and what it lacks, in the row
    expect(pembe).toHaveTextContent("MYL-2")
    expect(pembe).toHaveTextContent("3.100,00")
    expect(pembe).toHaveTextContent("Barkod yok")
    // Untracked stock is always sold (platform rule)
    expect(pembe).toHaveTextContent("Stok takibi yok — her zaman satılır")
    expect(pembe).toHaveAttribute("aria-expanded", "false")

    await user.click(pembe)
    expect(pembe).toHaveAttribute("aria-expanded", "true")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(within(form()).getByLabelText("Normal fiyat")).toHaveValue("3.100,00")
    // Codes, parcel and pictures in the same place, one under another
    expect(within(form()).getByLabelText("Barkod (GTIN)")).toBeInTheDocument()
    expect(within(form()).getByRole("heading", { name: "Ölçüler" })).toBeInTheDocument()

    await user.click(pembe)
    expect(screen.queryByRole("form")).toBeNull()
  })

  it("asks before another row's opening loses an unsaved change", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Sarı/))
    const price = within(form()).getByLabelText("Normal fiyat")
    await user.clear(price)
    await user.type(price, "2.900")
    await user.click(await row(/Renk: Mor/))
    const ask = screen.getByRole("alertdialog", { name: "Kaydedilmemiş değişiklikler atılsın mı?" })
    await user.click(within(ask).getByRole("button", { name: "Değişiklikleri at" }))

    expect(await row(/Renk: Mor/)).toHaveAttribute("aria-expanded", "true")
    expect(within(form()).getByLabelText("Normal fiyat")).toHaveValue("3.100,00")
    expect(batchVariants).not.toHaveBeenCalled()
  })

  it("joins the page's save bar: an edit counts there and the bar saves it", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Sarı/))
    const price = within(form()).getByLabelText("Normal fiyat")
    await user.clear(price)
    await user.type(price, "2.900")
    await user.click(screen.getByRole("button", { name: "Bar: 1" }))

    await waitFor(() => {
      expect(batchVariants).toHaveBeenCalledWith("prod_1", {
        update: [
          {
            id: "variant_1",
            prices: [{ id: "price_variant_1", currency_code: "try", amount: 2900 }],
          },
        ],
      })
    })
    await screen.findByRole("button", { name: "Bar: 0" })
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

    expect(await row(/Renk: Pembe/)).toHaveAttribute("aria-expanded", "true")
    const barcode = within(form()).getByLabelText("Barkod (GTIN)")
    await waitFor(() => {
      expect(barcode).toHaveFocus()
    })
    // The in-house code in `barcode` is not shown as a GTIN
    expect(barcode).toHaveValue("")
  })

  it("opens the first variant without a price on its price for the advisor's jump", async () => {
    renderCard({
      ...PRODUCT,
      variants: [variant("variant_1", "Sarı"), variant("variant_2", "Pembe", {}, null)],
    } as unknown as ProductDetail)
    await row(/Renk: Pembe/)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog")
    })
    act(() => {
      revealSection("product-variants")
    })
    expect(await row(/Renk: Pembe/)).toHaveAttribute("aria-expanded", "true")
    await waitFor(() => {
      expect(within(form()).getByLabelText("Normal fiyat")).toHaveFocus()
    })
  })

  it("refuses a mistyped barcode next to its field and sends nothing", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Pembe/))
    await user.type(within(form()).getByLabelText("Barkod (GTIN)"), "8690000000001")
    await user.click(within(form()).getByRole("button", { name: "Kaydet" }))

    expect(await within(form()).findByRole("alert")).toHaveTextContent(
      "Barkodun son rakamı tutmuyor"
    )
    expect(within(form()).getByLabelText("Barkod (GTIN)")).toHaveFocus()
    expect(batchVariants).not.toHaveBeenCalled()
  })

  it("saves the barcode to the EAN and the MPN to the catalog, leaving the in-house code alone", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Pembe/))
    await user.type(within(form()).getByLabelText("Barkod (GTIN)"), "4006381333931")
    await user.type(within(form()).getByLabelText("Üretici kodu (MPN)"), "RAF-25-ST")
    await user.click(within(form()).getByRole("button", { name: "Kaydet" }))

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

  it("ties pictures to the variant and saves their alt texts, in place", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await row(/Renk: Pembe/))

    // Its own picture, described here
    await user.type(within(form()).getByLabelText("1. görsel"), "Pembe kabzalı çakı, önden")
    // The product's other picture shows with every variant until one is tied to it
    const shared = within(form()).getByRole("button", {
      name: "1. görsel: Tüm varyantlarda görünür",
    })
    expect(shared).toHaveAttribute("aria-pressed", "false")
    await user.click(shared)
    await user.click(within(form()).getByRole("button", { name: "Kaydet" }))

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

    expect(within(form()).getByText(/Google bu barkodu kullanmaz/)).toBeInTheDocument()
    expect(within(form()).queryByRole("alert")).toBeNull()
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

    const price = screen.getByLabelText("Normal fiyat")
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

  it("opens the variant's dialog for all its details, and says untracked stock is always sold", async () => {
    const user = userEvent.setup()
    renderCard({
      ...PRODUCT,
      variants: [variant("variant_1", "Varsayılan", { sku: "MYL-1" })],
    } as unknown as ProductDetail)
    expect(
      await screen.findByText("Stok takibi yok: bu varyant her zaman satılır.")
    ).toBeInTheDocument()
    const details = screen.getByRole("button", { name: "Tüm varyant ayrıntıları" })
    await waitFor(() => {
      expect(details).toBeEnabled()
    })
    await user.click(details)
    expect(await screen.findByRole("dialog", { name: /Varyantı düzenle/ })).toBeVisible()
  })

  /** The owner, 2026-11-19: the stock count stood ~40 px below the price beside it. */
  it("keeps the location's note under the stock count, not above the stock fields", async () => {
    renderCard({
      ...PRODUCT,
      variants: [
        {
          ...variant("variant_1", "Varsayılan"),
          manage_inventory: true,
          inventory_items: [
            {
              inventory_item_id: "iitem_1",
              inventory: {
                location_levels: [
                  { location_id: "sloc_1", stocked_quantity: 12, reserved_quantity: 3 },
                ],
              },
            },
          ],
        },
      ],
    } as unknown as ProductDetail)
    const count = await screen.findByLabelText("Stok adedi")
    const note = await screen.findByText("Mağazanın varsayılan depo adresindeki adet.")
    // The note closes the count's own field, as the price's note does its field
    expect(note.parentElement).toContainElement(count)
    expect(note.previousElementSibling).toContainElement(count)
    const heading = screen.getByRole("heading", { name: "Stok" })
    // Nothing between the group's name and its fields: the same rows as "Fiyat"
    expect(heading.parentElement?.children).toHaveLength(1)
    expect(screen.getByText("Siparişe ayrılan")).toBeVisible()
  })
})
