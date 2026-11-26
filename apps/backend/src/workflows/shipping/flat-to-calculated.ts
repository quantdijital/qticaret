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
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import {
  ARAS_FULFILLMENT_PROVIDER_ID,
  MANUAL_FULFILLMENT_PROVIDER_ID,
  SHOP_FLAT_OPTION,
  SHOP_FULFILLMENT_PROVIDER_ID,
  YURTICI_FULFILLMENT_PROVIDER_ID,
} from "../../lib/shipping/carriers"

/**
 * The shop's flat-rate shipping options moved to our own pricing (adr/0087
 * §7): Medusa's flat price cannot know a basket of free-shipping products,
 * so each becomes a calculated option whose amount lives in `data.amount`
 * (kuruş, KDV in) and is priced by our quote. "Kendi gönderimim" moves from
 * Medusa's manual provider to ours (`shop_shop`); Aras's and Yurtiçi's
 * flat options stay with their carrier. Their prices go (the free one from
 * a basket total with them: the threshold is now part of the quote).
 * Pickup and returns keep Medusa's flat price. Run again, it finds nothing.
 */

interface PriceRow {
  id?: string
  amount?: MedusaAmount | null
  currency_code?: string | null
  price_rules?: ({ attribute?: string | null; operator?: string | null } | null)[] | null
}

export interface FlatOptionRow {
  id: string
  price_type?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
  prices?: (PriceRow | null)[] | null
  rules?: ({ attribute?: string | null; value?: unknown } | null)[] | null
  service_zone?: { fulfillment_set?: { type?: string | null } | null } | null
}

export interface FlatOptionUpdate {
  id: string
  price_type: "calculated"
  provider_id: string
  data: { id: string; amount: Kurus }
}

const FIELDS = [
  "id",
  "price_type",
  "provider_id",
  "data",
  "prices.id",
  "prices.amount",
  "prices.currency_code",
  "prices.price_rules.attribute",
  "prices.price_rules.operator",
  "rules.attribute",
  "rules.value",
  "service_zone.fulfillment_set.type",
]

const CONTRACT_FLAT: Readonly<Record<string, string>> = {
  [ARAS_FULFILLMENT_PROVIDER_ID]: "aras-flat",
  [YURTICI_FULFILLMENT_PROVIDER_ID]: "yurtici-flat",
}

/** The old free price from a basket total (F4.5): 0, one `item_total gte` rule. */
const isOldFreePrice = (price: PriceRow): boolean => {
  const rules = (price.price_rules ?? []).filter((rule) => rule !== null)
  return (
    Number(price.amount) === 0 &&
    rules.length === 1 &&
    rules[0]?.attribute === "item_total" &&
    rules[0].operator === "gte"
  )
}

export type OptionUpdate = FlatOptionUpdate | { id: string; prices: { id: string }[] }

/**
 * A flat option that stays flat (pickup) loses the old free price the sync
 * wrote: nothing keeps it in step with the threshold any more. Medusa keeps
 * the prices named by id alone and drops the rest.
 */
export function planFreePriceCleanup(option: FlatOptionRow): OptionUpdate | null {
  if (option.price_type !== "flat") {
    return null
  }
  const prices = (option.prices ?? []).filter((price): price is PriceRow => price !== null)
  if (!prices.some(isOldFreePrice)) {
    return null
  }
  return {
    id: option.id,
    prices: prices.flatMap((price) =>
      !isOldFreePrice(price) && price.id ? [{ id: price.id }] : []
    ),
  }
}

/** The shop's own price: the lira price without rules, else a region's (Medusa Admin's way). */
function baseAmountOf(option: FlatOptionRow): Kurus | null {
  const prices = (option.prices ?? []).filter((price): price is PriceRow => price !== null)
  const rulesOf = (price: PriceRow) => (price.price_rules ?? []).filter((rule) => rule !== null)
  const plain = prices.filter(
    (price) => price.currency_code === "try" && rulesOf(price).length === 0
  )
  // Lira regions only (security review 2026-11-26): another currency's amount is no kuruş
  const regions = prices.filter((price) => {
    const rules = rulesOf(price)
    return (
      price.currency_code === "try" &&
      rules.length === 1 &&
      rules[0]?.attribute === "region_id" &&
      rules[0].operator === "eq"
    )
  })
  const amounts = [
    ...new Set((plain.length > 0 ? plain : regions).flatMap((price) => kurusOf(price.amount))),
  ]
  // None, or several that differ: which one the shop meant is not ours to guess; it stays flat
  return amounts.length === 1 ? (amounts[0] ?? null) : null
}

function kurusOf(amount: MedusaAmount | null | undefined): Kurus[] {
  if (amount === null || amount === undefined) {
    return []
  }
  try {
    const read = fromMedusaAmount(amount, { allowRounding: true })
    return read >= 0 ? [read] : []
  } catch {
    return []
  }
}

/** The option's new form; null when it is not one to move (or has no price to move). */
export function planFlatConversion(option: FlatOptionRow): FlatOptionUpdate | null {
  if (option.price_type !== "flat") {
    return null
  }
  const isReturn = (option.rules ?? []).some(
    (rule) => rule?.attribute === "is_return" && String(rule.value).includes("true")
  )
  if (isReturn || option.service_zone?.fulfillment_set?.type === "pickup") {
    return null
  }
  const provider = option.provider_id ?? ""
  const contract = CONTRACT_FLAT[provider]
  const own = provider === MANUAL_FULFILLMENT_PROVIDER_ID
  if (!own && (!contract || option.data?.["id"] !== contract)) {
    return null
  }
  const amount = baseAmountOf(option)
  if (amount === null) {
    return null
  }
  return {
    id: option.id,
    price_type: "calculated",
    provider_id: own ? SHOP_FULFILLMENT_PROVIDER_ID : provider,
    data: { id: own ? SHOP_FLAT_OPTION : (contract ?? ""), amount },
  }
}

/** Reads the shop's options and works out the moves; read only. */
const planFlatConversionStep = createStep(
  "shipping-plan-flat-conversion",
  async (_, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "shipping_option",
      fields: FIELDS,
    })
    return new StepResponse(
      (data as unknown as FlatOptionRow[]).flatMap((option): OptionUpdate[] => {
        const update = planFlatConversion(option) ?? planFreePriceCleanup(option)
        return update ? [update] : []
      })
    )
  }
)

/**
 * Moves every flat-rate option the shop ships with to our pricing. Medusa's
 * own update writes them and puts them back if a later step fails. Returns
 * how many moved.
 */
export const convertFlatShippingOptionsWorkflow = createWorkflow(
  "shipping-convert-flat-options",
  () => {
    const updates = planFlatConversionStep()
    when({ updates }, ({ updates }) => updates.length > 0).then(() => {
      updateShippingOptionsWorkflow.runAsStep({ input: updates })
    })
    return new WorkflowResponse(transform({ updates }, ({ updates }) => updates.length))
  }
)
