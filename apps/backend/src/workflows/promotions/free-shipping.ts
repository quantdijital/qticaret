import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * Free shipping from a basket total (F4.5, ADR-0024): every flat-rate
 * shipping option gets a 0 price for baskets of at least the threshold
 * (`item_total gte`: KDV in, after discounts), beside each currency's own
 * price. That price is the platform's: amount 0, one `item_total gte`
 * rule. Other prices, with or without rules, stay as the shop set them.
 * Options priced by a carrier (calculated) take the threshold in their
 * provider, through the one shipping quote (`lib/shipping/quote.ts`,
 * adr/0087 §2; the hook in `workflows/hooks/shipping-quote-context.ts`).
 */

const RULE_ATTRIBUTE = "item_total"

interface PriceRuleRow {
  attribute?: string | null
  operator?: string | null
  value?: string | number | null
}

interface PriceRow {
  id: string
  amount?: number | string | null
  currency_code?: string | null
  price_rules?: (PriceRuleRow | null)[] | null
}

export interface ShippingOptionRow {
  id: string
  price_type?: string | null
  prices?: (PriceRow | null)[] | null
}

const OPTION_FIELDS = [
  "id",
  "price_type",
  "prices.id",
  "prices.amount",
  "prices.currency_code",
  "prices.price_rules.attribute",
  "prices.price_rules.operator",
  "prices.price_rules.value",
]

const present = <T>(rows: (T | null)[] | null | undefined): T[] =>
  (rows ?? []).filter((row): row is T => row !== null)

const REGION_ATTRIBUTE = "region_id"

/**
 * A shop's base price: a currency's plain price, or a region's (Medusa
 * Admin prices an option per region with one `region_id` rule).
 */
function isBasePrice(price: PriceRow): boolean {
  const rules = present(price.price_rules)
  return (
    rules.length === 0 ||
    (rules.length === 1 && rules[0]?.attribute === REGION_ATTRIBUTE && rules[0].operator === "eq")
  )
}

/** The platform's free price: 0 from a basket total, nothing else. */
export function isFreeShippingPrice(price: PriceRow): boolean {
  const rules = present(price.price_rules)
  return (
    Number(price.amount) === 0 &&
    rules.length === 1 &&
    rules[0]?.attribute === RULE_ATTRIBUTE &&
    rules[0].operator === "gte"
  )
}

type PriceUpdate =
  | { id: string }
  | {
      id?: string
      currency_code: string
      amount: number
      rules: { attribute: string; operator: "gte"; value: number }[]
    }

/**
 * An option's prices with free shipping from `threshold` (lira) in each
 * currency it has a base price in, or without it (null); null when the
 * option is already so, or is not flat-rate. Prices kept go by id alone:
 * Medusa leaves what it is not told about a price as it is.
 *
 * Medusa picks the price matching more rules, then the lowest: the free
 * price (one rule) beats a plain price (none) and ties a region's price
 * (one), where 0 is the lower. Below the threshold it does not match.
 */
export function planFreeShipping(
  option: ShippingOptionRow,
  threshold: number | null
): PriceUpdate[] | null {
  if (option.price_type !== "flat") {
    return null
  }
  const prices = present(option.prices)
  const ours = prices.filter(isFreeShippingPrice)
  const currencies = [
    ...new Set(
      prices.flatMap((price) =>
        price.currency_code && isBasePrice(price) ? [price.currency_code] : []
      )
    ),
  ]
  const wanted = threshold === null ? [] : currencies
  const already =
    ours.length === wanted.length &&
    wanted.every((currency) =>
      ours.some(
        (price) =>
          price.currency_code === currency &&
          Number(present(price.price_rules)[0]?.value) === threshold
      )
    )
  // Also true with no threshold and no free price left to take away
  if (already) {
    return null
  }
  const kept = prices.filter((price) => !isFreeShippingPrice(price)).map(({ id }) => ({ id }))
  const free = wanted.map((currency) => {
    const existing = ours.find((price) => price.currency_code === currency)
    return {
      ...(existing ? { id: existing.id } : {}),
      currency_code: currency,
      amount: 0,
      rules: [{ attribute: RULE_ATTRIBUTE, operator: "gte" as const, value: threshold ?? 0 }],
    }
  })
  return [...kept, ...free]
}

/** The shop's threshold now, in lira; null when free shipping by basket total is off. */
export async function freeShippingThreshold(container: MedusaContainer): Promise<number | null> {
  const section = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .readSection("promotions")
  const value = (section.values as { free_shipping_threshold?: number | null })
    .free_shipping_threshold
  return typeof value === "number" && value > 0 ? value : null
}

export interface SyncFreeShippingInput {
  /** The threshold to follow; the shop's stored one when left out. */
  threshold?: number | null | undefined
  /** The options to bring in line; all when left out. */
  option_ids?: string[] | undefined
}

/** Reads the options and works out their new prices; read only. */
const planFreeShippingStep = createStep(
  "promotions-free-shipping-plan",
  async (input: SyncFreeShippingInput, { container }) => {
    const threshold =
      input.threshold === undefined ? await freeShippingThreshold(container) : input.threshold
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "shipping_option",
      fields: OPTION_FIELDS,
      ...(input.option_ids ? { filters: { id: input.option_ids } } : {}),
    })
    const updates = (data as ShippingOptionRow[]).flatMap((option) => {
      const prices = planFreeShipping(option, threshold)
      return prices ? [{ id: option.id, prices }] : []
    })
    return new StepResponse(updates)
  }
)

/**
 * Brings the shipping options (all, or those named) in line with the free
 * shipping threshold: after the promotions settings are saved, and when an
 * option is made or changed. Medusa's own update writes the prices and
 * puts them back if a later step fails. Returns how many changed.
 */
export const syncFreeShippingWorkflow = createWorkflow(
  "promotions-free-shipping-sync",
  (input: SyncFreeShippingInput) => {
    const updates = planFreeShippingStep(input)
    when({ updates }, ({ updates }) => updates.length > 0).then(() => {
      updateShippingOptionsWorkflow.runAsStep({ input: updates })
    })
    return new WorkflowResponse(transform({ updates }, ({ updates }) => updates.length))
  }
)
