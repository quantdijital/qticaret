import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { ShippingClassesCard } from "./shipping-classes-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const SAVED: ShippingSettings = {
  handling_days_min: 1,
  handling_days_max: 2,
  transit_days_min: 1,
  transit_days_max: 3,
  same_day_cutoff_hour: null,
  rate_table: [],
  over_desi_price: 0,
  label_format: "100x150",
  label_custom: { width_mm: 100, height_mm: 150 },
  default_parcel: null,
  packing_slip_prices: false,
  shipping_classes: [{ key: "bulky", name: "Büyük ürün", surcharge: 15_000 }],
}

function renderCard(usage: Record<string, number>) {
  fetchMock.mockImplementation((url: string, init?: { body?: Partial<ShippingSettings> }) =>
    Promise.resolve(
      url.endsWith("/classes")
        ? { usage }
        : { section: "shipping", values: { ...SAVED, ...init?.body }, version: 2 }
    )
  )
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ShippingClassesCard saved={SAVED} />
    </QueryClientProvider>
  )
}

const saveCall = () =>
  fetchMock.mock.calls.find(([url]) => url === "/admin/platform-settings/shipping") as
    [string, { body: Partial<ShippingSettings> }] | undefined

describe("ShippingClassesCard (adr/0087 §4)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("lists the shop's own classes with their products, not the built-in free one, and adds one in place", async () => {
    renderCard({ free: 4, bulky: 12 })

    // The free class is the product's switch, not a locked row here (the owner, 2026-11-26)
    expect(await screen.findByText("12 ürün")).toBeInTheDocument()
    expect(screen.queryByText("4 ürün")).not.toBeInTheDocument()
    expect(screen.queryByText("Ücretsiz kargo")).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "1. sınıfın adı" })).toHaveValue("Büyük ürün")

    await userEvent.click(screen.getByRole("button", { name: "Sınıf ekle" }))
    await userEvent.type(screen.getByRole("textbox", { name: "2. sınıfın adı" }), "Ağır ürün")
    const surcharge = screen.getByRole("spinbutton", { name: "2. sınıfın ek ücreti" })
    await userEvent.clear(surcharge)
    await userEvent.type(surcharge, "250")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(saveCall()).toBeDefined()
    })
    const classes = saveCall()?.[1].body.shipping_classes ?? []
    expect(classes[0]).toEqual({ key: "bulky", name: "Büyük ürün", surcharge: 15_000 })
    expect(classes[1]).toMatchObject({ name: "Ağır ürün", surcharge: 25_000 })
    expect(classes[1]?.key).toMatch(/^c-[a-z0-9]+$/)
  })

  it("asks in the row before removing a class products use, and keeps it on Vazgeç", async () => {
    renderCard({ bulky: 12 })
    await screen.findByText("12 ürün")

    await userEvent.click(screen.getByRole("button", { name: "Büyük ürün sınıfını sil" }))
    expect(screen.getByRole("alert")).toHaveTextContent("12 ürün Standart'a döner.")
    await userEvent.click(screen.getByRole("button", { name: "Vazgeç" }))
    expect(screen.getByRole("textbox", { name: "1. sınıfın adı" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Büyük ürün sınıfını sil" }))
    await userEvent.click(screen.getByRole("button", { name: "Sil" }))
    expect(screen.queryByRole("textbox", { name: "1. sınıfın adı" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saveCall()?.[1].body).toEqual({ shipping_classes: [] })
    })
  })

  it("refuses a class without a name", async () => {
    renderCard({})
    await userEvent.click(screen.getByRole("button", { name: "Sınıf ekle" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText(/Sınıfa bir ad verin/)).toBeInTheDocument()
    expect(saveCall()).toBeUndefined()
  })
})
