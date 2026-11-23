import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import type { ProductDetail } from "@/features/products/api/products"
import { OrganizeCard } from "./organize-card"

const fetchMock = vi.hoisted(() => vi.fn())
const admin = vi.hoisted(() => ({ product: { update: vi.fn() } }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The pickers search the server; here each offers one choice and a way to clear
vi.mock("@qticaret/admin-ui/patterns/search-picker", () => ({
  SearchPicker: ({
    id,
    value,
    onChange,
  }: {
    id: string
    value: PickerOption | null
    onChange: (value: PickerOption | null) => void
  }) => (
    <div>
      <span data-testid={`${id}-value`}>{value?.label ?? "—"}</span>
      <button
        type="button"
        onClick={() => {
          onChange({ id: `${id}-2`, label: "Kış Seçkisi" })
        }}
      >
        {`pick ${id}`}
      </button>
      <button
        type="button"
        onClick={() => {
          onChange(null)
        }}
      >
        {`clear ${id}`}
      </button>
    </div>
  ),
}))
vi.mock("@/features/products/components/category-tree", () => ({ CategoryTree: () => null }))
vi.mock("@/features/products/components/vat-select", () => ({ VatSelect: () => null }))

const PRODUCT = {
  id: "prod_1",
  title: "Şef Bıçağı",
  categories: [],
  type: null,
  brand: null,
  collection: { id: "pcol_1", title: "Yaz Seçkisi" },
} as unknown as ProductDetail

function renderCard(product: ProductDetail = PRODUCT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OrganizeCard product={product} />
    </QueryClientProvider>
  )
}

describe("OrganizeCard's collection", () => {
  beforeEach(() => {
    // No AI task offered: the picks beside categories and tags draw nothing
    fetchMock
      .mockReset()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url === "/admin/ai/services"
            ? { services: [], tasks: [], flags: { own_keys: true } }
            : { rates: [], default: null }
        )
      )
    admin.product.update.mockReset().mockResolvedValue({ product: PRODUCT })
  })

  it("shows the product's collection on its line, or that it has none", () => {
    const { unmount } = renderCard()
    expect(screen.getByText("Yaz Seçkisi")).toBeInTheDocument()
    unmount()

    renderCard({ ...PRODUCT, collection: null })
    expect(screen.getByText("Koleksiyon yok")).toBeInTheDocument()
  })

  it("moves the product to another collection through its own update, and only that", async () => {
    renderCard()

    await userEvent.click(screen.getByRole("button", { name: /düzenle/i }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByTestId("detail-collection-value")).toHaveTextContent("Yaz Seçkisi")
    await userEvent.click(within(dialog).getByRole("button", { name: "pick detail-collection" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(admin.product.update).toHaveBeenCalledWith("prod_1", {
        collection_id: "detail-collection-2",
      })
    })
  })

  it("offers no collection, on its line or in the dialog, while the shop has collections off", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/features"
          ? {
              features: [
                { key: "catalog.collections", default: true, owner: "tenant", enabled: false },
              ],
            }
          : url === "/admin/ai/services"
            ? { services: [], tasks: [], flags: { own_keys: true } }
            : { rates: [], default: null }
      )
    )
    renderCard()

    await waitFor(() => {
      expect(screen.queryByText("Yaz Seçkisi")).toBeNull()
    })
    expect(screen.queryByText("Koleksiyon")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /düzenle/i }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByTestId("detail-collection-value")).toBeNull()
    expect(within(dialog).getByTestId("detail-brand-value")).toBeInTheDocument()
  })

  it("takes the product out of its collection", async () => {
    renderCard()

    await userEvent.click(screen.getByRole("button", { name: /düzenle/i }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "clear detail-collection" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(admin.product.update).toHaveBeenCalledWith("prod_1", { collection_id: null })
    })
  })
})
