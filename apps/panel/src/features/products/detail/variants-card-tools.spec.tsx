import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { VariantsCard } from "./variants-card"
import { answer, PRODUCT, stocked, variant } from "./variants-card.fixture"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())
const batchVariants = vi.hoisted(() => vi.fn<(id: string, body: unknown) => Promise<unknown>>())
const linkOptions = vi.hoisted(() => vi.fn<(id: string, body: unknown) => Promise<unknown>>())
const levels = vi.hoisted(() => vi.fn<(body: unknown) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: {
      store: { list: () => Promise.resolve({ stores: [{ default_location_id: "sloc_1" }] }) },
      shippingProfile: { list: () => Promise.resolve({ shipping_profiles: [] }) },
      product: { batchVariants, linkOptions, batchVariantImages: vi.fn(), update: vi.fn() },
      inventoryItem: { batchInventoryItemsLocationLevels: levels },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function renderCard(product: ProductDetail = PRODUCT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VariantsCard product={product} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  batchVariants.mockReset()
  linkOptions.mockReset()
  levels.mockReset()
  fetchMock.mockImplementation((url) => Promise.resolve(answer(url)))
  batchVariants.mockResolvedValue({})
  linkOptions.mockResolvedValue({})
  levels.mockResolvedValue({})
})

/** The owner, 2026-11-25: options as chips, "Varyantları oluştur", bulk price and stock. */
describe("the variants card's options", () => {
  it("adds a value and creates the missing variant, counted first, without a price", async () => {
    const user = userEvent.setup()
    renderCard()
    expect(await screen.findByText("Renk: Sarı, Pembe, Mor")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Seçenekleri düzenle" }))
    await user.type(screen.getByRole("textbox", { name: "Renk değerleri" }), "Mavi{Enter}")
    expect(screen.getByText(/1 varyant oluşturulacak/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "1 varyantı oluştur" }))

    await waitFor(() => {
      expect(batchVariants).toHaveBeenCalledWith("prod_1", {
        create: [
          {
            title: "Mavi",
            options: { Renk: "Mavi" },
            variant_rank: 4,
            manage_inventory: false,
            allow_backorder: false,
            prices: [],
          },
        ],
        update: [],
      })
    })
    expect(linkOptions).toHaveBeenCalledWith("prod_1", {
      update: [{ product_option_id: "opt_color", add: [{ value: "Mavi" }], remove: [] }],
    })
    // The options are saved before the variants that need them
    expect(linkOptions.mock.invocationCallOrder[0]).toBeLessThan(
      batchVariants.mock.invocationCallOrder[0] ?? 0
    )
  })

  it("keeps a value a variant stands for", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("button", { name: "Seçenekleri düzenle" }))
    await user.click(screen.getByRole("button", { name: "Pembe değerini kaldır" }))
    expect(screen.getByRole("status")).toHaveTextContent('"Pembe" değerini kullanan varyant var')
    expect(screen.getByRole("button", { name: "Pembe değerini kaldır" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Seçeneği kaldır" })).toBeDisabled()
  })

  it("gives a product of one variant its options and variants", async () => {
    const user = userEvent.setup()
    renderCard({
      ...PRODUCT,
      options: [{ id: "opt_default", title: "Seçenek", values: [{ id: "v0", value: "Standart" }] }],
      variants: [
        {
          ...variant("variant_1", "Standart"),
          options: [{ value: "Standart", option_id: "opt_default" }],
        },
      ],
    } as unknown as ProductDetail)
    await user.click(await screen.findByRole("button", { name: "Seçenek ekle" }))
    await user.click(screen.getByRole("button", { name: "+ Renk" }))
    await user.type(screen.getByRole("textbox", { name: "Renk değerleri" }), "Kırmızı, Mavi{Enter}")
    expect(screen.getByText(/1 varyanta yeni seçeneğin ilk değeri verilecek/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "1 varyantı oluştur" }))

    await waitFor(() => {
      expect(batchVariants).toHaveBeenCalledWith("prod_1", {
        create: [expect.objectContaining({ options: { Seçenek: "Standart", Renk: "Mavi" } })],
        update: [{ id: "variant_1", options: { Seçenek: "Standart", Renk: "Kırmızı" } }],
      })
    })
    expect(linkOptions).toHaveBeenCalledWith("prod_1", {
      add: [{ title: "Renk", values: ["Kırmızı", "Mavi"], is_exclusive: true }],
    })
  })
})

describe("the variants card's bulk change", () => {
  it("gives a price to the variants of one value", async () => {
    const user = userEvent.setup()
    renderCard()
    const bar = await screen.findByRole("group", { name: "Toplu değişiklik" })
    await user.type(within(bar).getByRole("spinbutton", { name: "Yeni değer" }), "2.900")
    await user.click(within(bar).getByRole("combobox", { name: "Hangi varyantlar" }))
    await user.click(await screen.findByRole("option", { name: "Renk: Pembe" }))
    await user.click(within(bar).getByRole("button", { name: "1 varyanta uygula" }))

    await waitFor(() => {
      expect(batchVariants).toHaveBeenCalledWith("prod_1", {
        update: [
          {
            id: "variant_2",
            prices: [{ id: "price_variant_2", currency_code: "try", amount: 2900 }],
          },
        ],
      })
    })
  })

  it("sets the stock of the picked variants, skipping one not counted", async () => {
    const user = userEvent.setup()
    renderCard({
      ...PRODUCT,
      variants: [
        stocked("variant_1", "Sarı", 2),
        stocked("variant_2", "Pembe", 0),
        variant("variant_3", "Mor"),
      ],
    } as unknown as ProductDetail)
    const bar = await screen.findByRole("group", { name: "Toplu değişiklik" })
    await user.click(within(bar).getByRole("combobox", { name: "Değiştirilecek alan" }))
    await user.click(await screen.findByRole("option", { name: "Stok adedi" }))
    await user.click(screen.getByRole("checkbox", { name: "Tüm varyantları seç" }))
    await user.type(within(bar).getByRole("spinbutton", { name: "Yeni değer" }), "7")
    await user.click(within(bar).getByRole("button", { name: "Seçilen 3 varyanta uygula" }))

    await waitFor(() => {
      expect(levels).toHaveBeenCalledWith({
        create: [],
        update: ["variant_1", "variant_2"].map((id) => ({
          inventory_item_id: `iitem_${id}`,
          location_id: "sloc_1",
          stocked_quantity: 7,
        })),
      })
    })
    expect(batchVariants).not.toHaveBeenCalled()
  })
})
