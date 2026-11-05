import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
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

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: {
      store: { list: () => Promise.resolve({ stores: [{ default_location_id: "sloc_1" }] }) },
      shippingProfile: { list: () => Promise.resolve({ shipping_profiles: [] }) },
      product: { batchVariants },
      inventoryItem: { batchInventoryItemsLocationLevels: vi.fn() },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const variant = (id: string, title: string, codes: Record<string, string | null>) => ({
  id,
  title,
  variant_rank: Number(id.slice(-1)),
  manage_inventory: false,
  allow_backorder: false,
  sku: null,
  ean: null,
  upc: null,
  barcode: null,
  ...codes,
  prices: [{ id: `price_${id}`, amount: 3100, currency_code: "try" }],
  inventory_items: [],
})

const PRODUCT = {
  id: "prod_1",
  title: "Yatağan Çakı",
  updated_at: "2026-11-05T09:00:00Z",
  variants: [
    variant("variant_1", "Sarı", { sku: "MYL-1", ean: "8690000000005" }),
    variant("variant_2", "Pembe", { sku: "MYL-2", barcode: "RAF-25" }),
  ],
} as unknown as ProductDetail

const CATALOG = {
  variants: [
    { id: "variant_1", title: "Sarı", sku: "MYL-1", mpn: null, cost: null, gtin: "8690000000005" },
    { id: "variant_2", title: "Pembe", sku: "MYL-2", mpn: null, cost: null, gtin: null },
  ],
} as unknown as ProductCatalog

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VariantsCard product={PRODUCT} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  batchVariants.mockReset()
  fetchMock.mockImplementation((url) =>
    Promise.resolve(url === "/admin/features" ? { features: [] } : CATALOG)
  )
  batchVariants.mockResolvedValue({})
})

describe("the variants card's codes", () => {
  it("opens the codes view at the first variant without a barcode for the advisor's jump", async () => {
    renderCard()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog")
    })
    expect(screen.queryByLabelText("Pembe Barkod (GTIN)")).toBeNull()

    act(() => {
      revealSection(VARIANT_CODES_TARGET)
    })

    const barcode = screen.getByLabelText("Pembe Barkod (GTIN)")
    expect(barcode).toHaveFocus()
    expect(barcode).toHaveValue("")
    // The in-house code in `barcode` is not shown as a GTIN; the EAN in use is
    expect(screen.getByLabelText("Sarı Barkod (GTIN)")).toHaveValue("8690000000005")
    expect(screen.getByRole("radio", { name: "Kodlar" })).toHaveAttribute("aria-checked", "true")
  })

  it("refuses a mistyped barcode in place and sends nothing", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByRole("radio", { name: "Kodlar" }))
    await user.type(screen.getByLabelText("Pembe Barkod (GTIN)"), "8690000000001")
    await user.click(screen.getByRole("radio", { name: "Fiyat ve stok" }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Barkodun son rakamı tutmuyor")
    // Back in the codes view, the caret in the refused field
    expect(screen.getByLabelText("Pembe Barkod (GTIN)")).toHaveFocus()
    expect(batchVariants).not.toHaveBeenCalled()
  })

  it("saves the barcode to the EAN and the MPN to the catalog, leaving the in-house code alone", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByRole("radio", { name: "Kodlar" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog")
    })
    await user.type(screen.getByLabelText("Pembe Barkod (GTIN)"), "4006381333931")
    await user.type(screen.getByLabelText("Pembe Üretici kodu (MPN)"), "RAF-25-ST")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

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

  it("lets a stored code that is not a GTIN through, pointing it out", async () => {
    const user = userEvent.setup()
    const stored = {
      ...PRODUCT,
      variants: [variant("variant_1", "Sarı", { ean: "4006381333932" })],
    } as unknown as ProductDetail
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <VariantsCard product={stored} />
      </QueryClientProvider>
    )
    await user.click(screen.getByRole("radio", { name: "Kodlar" }))

    expect(screen.getByText(/Google bu barkodu kullanmaz/)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
