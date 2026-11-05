import { marketingSection } from "../../../modules/platform-settings/sections/marketing"
import { shippingSection } from "../../../modules/platform-settings/sections/shipping"
import { storefrontDelivery } from "../delivery"

// adr/0046 Ek 2026-11-06: the product page's delivery facts, as the shop set them
describe("storefrontDelivery", () => {
  const days = {
    handling_days_min: 0,
    handling_days_max: 1,
    transit_days_min: 2,
    transit_days_max: 4,
  }

  it("says the platform's days and no same-day hour for a shop that set nothing", () => {
    expect(storefrontDelivery(shippingSection.defaults, marketingSection.defaults)).toEqual({
      handling_days: { min: 1, max: 2 },
      transit_days: { min: 1, max: 3 },
      same_day_cutoff_hour: null,
    })
  })

  it("carries the shop's days and the same-day hour it set under Kargo", () => {
    expect(
      storefrontDelivery({ ...days, same_day_cutoff_hour: 15 }, { feed_same_day_cutoff_hour: 11 })
    ).toEqual({
      handling_days: { min: 0, max: 1 },
      transit_days: { min: 2, max: 4 },
      same_day_cutoff_hour: 15,
    })
  })

  it("keeps the hour a shop set under the feed rules before it moved", () => {
    expect(
      storefrontDelivery({ ...days, same_day_cutoff_hour: null }, { feed_same_day_cutoff_hour: 16 })
        .same_day_cutoff_hour
    ).toBe(16)
  })
})
