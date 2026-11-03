import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { singleUseCode } from "../../lib/promotions"
import type { PaymentLinkDiscount } from "../../lib/payment-links/snapshot"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A link's discount is a Medusa promotion of its own (adr/0051 §2): one
 * code, used once, in a campaign of its own that the promotions list
 * leaves out. The invoice shows it as a discount, the reports as one.
 */
export const PAYMENT_LINK_CAMPAIGN = "qt-payment-links"
const CODE_PREFIX = "PL"

/** The campaign that holds every link's promotion, made the first time one is needed. */
async function linkCampaign(container: Container): Promise<string> {
  const promotions = container.resolve(Modules.PROMOTION)
  const find = async () =>
    (
      await promotions.listCampaigns(
        { campaign_identifier: [PAYMENT_LINK_CAMPAIGN] },
        { select: ["id"], take: 1 }
      )
    )[0]?.id
  const existing = await find()
  if (existing) {
    return existing
  }
  try {
    const [made] = await promotions.createCampaigns([
      { name: "Ödeme bağlantıları", campaign_identifier: PAYMENT_LINK_CAMPAIGN },
    ])
    if (made) {
      return made.id
    }
  } catch (error) {
    // Two links made at once: the other one made it
    if (!uniqueViolationKeys(error)) {
      throw error
    }
  }
  const raced = await find()
  if (!raced) {
    throw new Error("payment links: the campaign could not be made")
  }
  return raced
}

/** The ids of the campaigns the promotions list leaves out for links. */
export async function linkCampaignIds(container: Container): Promise<string[]> {
  const rows = await container
    .resolve(Modules.PROMOTION)
    .listCampaigns({ campaign_identifier: [PAYMENT_LINK_CAMPAIGN] }, { select: ["id"], take: 5 })
  return rows.map((row) => row.id)
}

/** The link's promotion: a code no one else has, active, usable once. */
export async function createLinkPromotion(
  container: Container,
  discount: PaymentLinkDiscount
): Promise<{ id: string; code: string }> {
  const promotions = container.resolve(Modules.PROMOTION)
  const campaignId = await linkCampaign(container)
  const code = singleUseCode(CODE_PREFIX)
  const [made] = await promotions.createPromotions([
    {
      code,
      type: "standard",
      is_automatic: false,
      // Lira prices include KDV: a fixed amount comes off the gross total
      is_tax_inclusive: true,
      status: "active",
      limit: 1,
      campaign_id: campaignId,
      application_method: {
        type: discount.type,
        target_type: "order",
        allocation: "across",
        value: discount.type === "percentage" ? discount.value : discount.amount / 100,
        ...(discount.type === "fixed" ? { currency_code: "try" } : {}),
      },
    },
  ])
  if (!made) {
    throw new Error("payment links: the promotion was not made")
  }
  return { id: made.id, code }
}

/** A closed link's code stops working; it stays for the orders and reports that name it. */
export async function closeLinkPromotion(
  container: Container,
  promotionId: string | null
): Promise<void> {
  if (promotionId) {
    await container
      .resolve(Modules.PROMOTION)
      .updatePromotions([{ id: promotionId, status: "inactive" }])
  }
}

/** Puts a closed link's code back (an undone cancel or end). */
export async function reopenLinkPromotion(
  container: Container,
  promotionId: string | null
): Promise<void> {
  if (promotionId) {
    await container
      .resolve(Modules.PROMOTION)
      .updatePromotions([{ id: promotionId, status: "active" }])
  }
}
