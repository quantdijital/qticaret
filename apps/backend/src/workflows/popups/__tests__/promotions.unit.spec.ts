import { PAYMENT_LINK_CAMPAIGN } from "../../payment-links/promotion"
import { batchIdentifier } from "../../promotions/code-batches"
import { isLinkablePromotion } from "../promotions"

describe("isLinkablePromotion", () => {
  it("allows a shop's own promotion, with or without a campaign or a limit", () => {
    expect(isLinkablePromotion({ limit: null, campaign: null })).toBe(true)
    expect(isLinkablePromotion({ limit: 100, campaign: { campaign_identifier: "kis-2026" } })).toBe(
      true
    )
  })

  it("refuses a single-use batch's copy and a payment link's code", () => {
    expect(
      isLinkablePromotion({
        limit: null,
        campaign: { campaign_identifier: batchIdentifier("promo_01TEMPLATE") },
      })
    ).toBe(false)
    expect(
      isLinkablePromotion({ limit: null, campaign: { campaign_identifier: PAYMENT_LINK_CAMPAIGN } })
    ).toBe(false)
  })

  it("refuses a promotion used at most once", () => {
    expect(isLinkablePromotion({ limit: 1, campaign: null })).toBe(false)
  })
})
