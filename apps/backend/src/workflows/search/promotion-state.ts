import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { offerState } from "../../lib/pricing/offer-state"
import type { PromotionStateRow } from "../../lib/pricing/offer-state"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { CURRENCY } from "../catalog/prices"
import { queueAllProducts } from "./drain"

/**
 * The automatic promotions' side of the index's minute (adr/0056, adr/0023
 * Ek 2026-11-05). A promotion every shopper gets is a product's price, so
 * it decides `on_sale`; but a campaign that begins or ends changes no
 * row and sends no event of the catalogue's (one with a budget is no
 * price, adr/0076 Ek 2026-11-25). Each minute the promotions are read as
 * they stand (a few rows) and compared with the last reading every
 * process shares; when they differ, every
 * product is indexed again (a promotion may cover the whole catalogue).
 */

/** The key the reading is kept under (search-index `search_index_state`). */
export const OFFER_STATE = "automatic_offers"

const RULE = ["attribute", "operator", "values.value"]

const FIELDS = [
  "code",
  "type",
  "status",
  "is_automatic",
  "is_tax_inclusive",
  "created_at",
  "limit",
  ...RULE.map((field) => `rules.${field}`),
  "application_method.type",
  "application_method.target_type",
  "application_method.allocation",
  "application_method.value",
  "application_method.max_quantity",
  "application_method.currency_code",
  "application_method.buy_rules_min_quantity",
  ...RULE.map((field) => `application_method.target_rules.${field}`),
  "campaign.starts_at",
  "campaign.ends_at",
  "campaign.budget.type",
  "campaign.budget.limit",
]

/** The rows as the fields read them; the graph's own type differs between a built checkout and a bare one. */
const rowsOf = (data: readonly unknown[]): PromotionStateRow[] => data as PromotionStateRow[]

/** The shop's automatic promotions that are a price, as they apply at `now`, in one key. */
export async function automaticOfferState(container: MedusaContainer, now: Date): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "promotion",
    fields: FIELDS,
    filters: { is_automatic: true },
  })
  return offerState(rowsOf(data), CURRENCY, now)
}

/**
 * Every product marked to be indexed again when the automatic promotions
 * changed since the last reading (or none was kept); true when they did.
 * The reading is kept after the products are marked, so a failure is
 * tried again the next minute.
 */
export async function queueOnOfferChange(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<boolean> {
  const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
  const [state, previous] = await Promise.all([
    automaticOfferState(container, now),
    index.readState(OFFER_STATE),
  ])
  if (state === previous) {
    return false
  }
  await queueAllProducts(container)
  await index.writeState(OFFER_STATE, state)
  return true
}
