import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { ParcelPanel } from "./parcel-panel"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const PRODUCT = {
  id: "prod_1",
  weight: null,
  length: null,
  width: null,
  height: null,
} as unknown as ProductDetail

function answer(
  shippingClass: string | null,
  classes = [{ key: "bulky", name: "Büyük ürün", surcharge: 15_000 }]
) {
  fetchMock.mockImplementation((url: string, init?: { body?: Record<string, unknown> }) => {
    if (url.includes("/catalog")) {
      return Promise.resolve({ shipping_class: shippingClass, ...init?.body })
    }
    if (url.endsWith("/platform-settings/shipping")) {
      return Promise.resolve({
        section: "shipping",
        version: 1,
        values: { shipping_classes: classes },
      })
    }
    if (url.endsWith("/platform-settings/store")) {
      return Promise.resolve({
        section: "store",
        version: 1,
        values: { weight_unit: "g", dimension_unit: "cm" },
      })
    }
    return Promise.resolve({ product: PRODUCT })
  })
}

function renderPanel() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ParcelPanel product={PRODUCT} />
    </QueryClientProvider>
  )
}

const catalogSaves = () =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).includes("/catalog") &&
      (init as { method?: string } | undefined)?.method === "POST"
  )

describe("ParcelPanel: the product's shipping class (adr/0087 §4)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the class's surcharge and saves the class alone, not the measures", async () => {
    answer("bulky")
    renderPanel()

    expect(await screen.findByText(/kargosuna ₺150,00 eklenir/)).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Kargo sınıfı" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("switch", { name: "Bu ürünün kargosu ücretsiz" }))
    expect(screen.getByText(/kargo ücretine eklenmez/)).toBeInTheDocument()
    // Free: no class to pick beside it
    expect(screen.queryByRole("combobox", { name: "Kargo sınıfı" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(catalogSaves()).toHaveLength(1)
    })
    expect(catalogSaves()[0]?.[1]).toMatchObject({ body: { shipping_class: "free" } })
    // The measures were not touched: no product save
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) === "/admin/products/prod_1" &&
          (init as { method?: string } | undefined)?.method === "POST"
      )
    ).toBe(false)
  })

  it("sends null for Standard", async () => {
    answer("free")
    renderPanel()
    expect(await screen.findByText(/kargo ücretine eklenmez/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("switch", { name: "Bu ürünün kargosu ücretsiz" }))
    expect(screen.getByRole("combobox", { name: "Kargo sınıfı" })).toHaveTextContent("Standart")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(catalogSaves()[0]?.[1]).toMatchObject({ body: { shipping_class: null } })
    })
  })

  it("shows only the switch while the shop has no classes of its own", async () => {
    answer(null, [])
    renderPanel()
    const free = await screen.findByRole("switch", { name: "Bu ürünün kargosu ücretsiz" })
    expect(free).not.toBeChecked()
    expect(screen.queryByRole("combobox", { name: "Kargo sınıfı" })).not.toBeInTheDocument()
  })
})
