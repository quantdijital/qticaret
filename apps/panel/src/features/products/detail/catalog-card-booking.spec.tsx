import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { CatalogCard } from "./catalog-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "service",
  booking_mode: "none",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  addons: [],
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [],
  variants: [],
}

const FUTURE = "2099-05-02T06:00:00.000Z"

function setup(catalog: Partial<ProductCatalog>, flags: Record<string, boolean>) {
  fetchMock.mockImplementation((url: string, init?: { body?: Partial<ProductCatalog> }) => {
    if (url === "/admin/features") {
      return Promise.resolve({
        features: Object.entries(flags).map(([key, enabled]) => ({ key, enabled })),
      })
    }
    if (url.includes("/booking-slots")) {
      return Promise.resolve({
        slots: [
          { id: "s1", starts_at: FUTURE, status: "open", capacity: 10, sold: 3, held: 1 },
          { id: "s2", starts_at: FUTURE, status: "cancelled", capacity: 10, sold: 5, held: 0 },
        ],
      })
    }
    return Promise.resolve({ ...CATALOG, ...catalog, ...init?.body })
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CatalogCard productId="prod_1" />
    </QueryClientProvider>
  )
}

async function openDialog() {
  await userEvent.click(await screen.findByRole("button", { name: "Katalog bilgileri: düzenle" }))
  return screen.getByRole("dialog", { name: "Katalog bilgileri" })
}

const ON = { "catalog.non_physical": true, "catalog.booking": true }

describe("CatalogCard: dated sale", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("offers dated sale off by default for a service once the flag is on, and sends it", async () => {
    setup({}, ON)
    const dialog = await openDialog()
    const toggle = await within(dialog).findByRole("switch", { name: "Tarihli satış (kalkışlı)" })
    expect(toggle).not.toBeChecked()

    await userEvent.click(toggle)
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { booking_mode: "departure" },
      })
    })
  })

  it("does not offer it without the flag", async () => {
    setup({}, { "catalog.non_physical": true })
    const dialog = await openDialog()
    await within(dialog).findByRole("combobox", { name: "Ürün türü" })
    expect(within(dialog).queryByRole("switch", { name: "Tarihli satış (kalkışlı)" })).toBeNull()
  })

  it("does not offer it for a physical product", async () => {
    setup({ kind: "physical" }, ON)
    const dialog = await openDialog()
    await within(dialog).findByRole("combobox", { name: "Ürün türü" })
    expect(within(dialog).queryByRole("switch", { name: "Tarihli satış (kalkışlı)" })).toBeNull()
  })

  it("warns before turning it off: stock tracking stays off, places ahead are counted", async () => {
    setup({ booking_mode: "departure" }, ON)
    const dialog = await openDialog()
    const toggle = await within(dialog).findByRole("switch", { name: "Tarihli satış (kalkışlı)" })
    expect(toggle).toBeChecked()

    await userEvent.click(toggle)
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    const confirm = await screen.findByRole("alertdialog", { name: "Tarihli satış kapatılsın mı?" })
    expect(confirm).toHaveTextContent("Stok takibi kendiliğinden açılmaz")
    // The open departure's 3 sold and 1 held; the cancelled one holds none
    expect(await within(confirm).findByText(/4 satılmış ya da sepette tutulan yer/)).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/products/prod_1/catalog", expect.anything())

    await userEvent.click(within(confirm).getByRole("button", { name: "Tarihli satışı kapat" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { booking_mode: "none" },
      })
    })
  })
})
