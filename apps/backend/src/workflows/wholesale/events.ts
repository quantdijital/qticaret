import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules, PricingEvents } from "@medusajs/framework/utils"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"

const PRICE_EVENTS: readonly string[] = [
  PricingEvents.PRICE_CREATED,
  PricingEvents.PRICE_UPDATED,
  PricingEvents.PRICE_DELETED,
]
const LIST_RULE_EVENTS: readonly string[] = [
  PricingEvents.PRICE_LIST_RULE_CREATED,
  PricingEvents.PRICE_LIST_RULE_UPDATED,
  PricingEvents.PRICE_LIST_RULE_DELETED,
]
// A deleted row still says which list it was on
const ONE = { take: 1, withDeleted: true } as const

/** The price list a pricing event's record is on: the price's, the rule's, or the list itself. */
export async function priceListOfEvent(
  container: MedusaContainer,
  name: string,
  id: string
): Promise<string | null> {
  const pricing = container.resolve(Modules.PRICING)
  if (PRICE_EVENTS.includes(name)) {
    const [price] = await pricing.listPrices({ id: [id] }, { select: ["price_list_id"], ...ONE })
    return (price as { price_list_id?: string | null } | undefined)?.price_list_id ?? null
  }
  if (LIST_RULE_EVENTS.includes(name)) {
    const [rule] = await pricing.listPriceListRules(
      { id: [id] },
      { select: ["price_list_id"], ...ONE }
    )
    // Selected as the column; the DTO names only the relation
    return (rule as { price_list_id?: string | null } | undefined)?.price_list_id ?? null
  }
  return name.startsWith("pricing.price-list.") ? id : null
}

/**
 * A pricing event about a wholesale list's own rows or the list itself
 * (ADR-0068 §7): no public price changed, so the price history and the
 * search index pass it by. A sync writes a whole catalogue's rows.
 */
export async function isWholesalePriceEvent(
  container: MedusaContainer,
  name: string,
  id: string
): Promise<boolean> {
  if (!name.startsWith("pricing.")) {
    return false
  }
  const listId = await priceListOfEvent(container, name, id)
  if (!listId) {
    return false
  }
  const owned = await container.resolve<WholesaleModuleService>(WHOLESALE_MODULE).ownedIds()
  return owned.priceListIds.has(listId)
}
