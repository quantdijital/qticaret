import { inventorySection } from "../../../modules/platform-settings/sections/inventory"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { planFilters } from "../listing-plan"
import { hidesOutOfStock, withStockRule } from "../listing-stock"

const settingsWith = (values: Record<string, unknown>) => ({
  resolve: (key: string) => {
    expect(key).toBe(PLATFORM_SETTINGS_MODULE)
    return { getSection: () => Promise.resolve(values) }
  },
})

describe("sold-out products in listings (T1)", () => {
  it("shows them by default, as before", () => {
    expect(inventorySection.defaults.out_of_stock_listing).toBe("show")
    expect(inventorySection.full.safeParse({ ...inventorySection.defaults }).success).toBe(true)
    expect(inventorySection.patch.safeParse({ out_of_stock_listing: "hide" }).success).toBe(true)
    expect(inventorySection.patch.safeParse({ out_of_stock_listing: "sona-at" }).success).toBe(
      false
    )
  })

  it("reads the shop's choice; anything but hide shows them", async () => {
    await expect(hidesOutOfStock(settingsWith({ out_of_stock_listing: "hide" }))).resolves.toBe(
      true
    )
    await expect(hidesOutOfStock(settingsWith({ out_of_stock_listing: "show" }))).resolves.toBe(
      false
    )
    await expect(hidesOutOfStock(settingsWith({ low_stock_threshold: 5 }))).resolves.toBe(false)
  })

  it("holds in stock only on while hiding, the shopper's own filters kept", () => {
    const filters = planFilters([
      ["marka", ["kesk"]],
      ["renk", ["siyah"]],
    ])
    expect(withStockRule(filters, false)).toBe(filters)
    expect(withStockRule(filters, true)).toEqual({ ...filters, in_stock: true })
    expect(filters.in_stock).toBe(false)
  })
})
