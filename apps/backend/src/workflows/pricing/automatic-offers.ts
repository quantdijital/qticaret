import type {
  ComputeActionContext,
  ComputeActionItemLine,
  MedusaContainer,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import { fromMedusaAmount, kurus, toMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { offerOf } from "../../lib/pricing/offers"
import type { CartOffer, Offer, PriceOffer, PromotionRow } from "../../lib/pricing/offers"

type Resolver = Pick<MedusaContainer, "resolve">

/** What the automatic promotions make of a variant's price before the cart (adr/0023 Ek 2026-11-05). */
export interface VariantOffers {
  /** The offers that are the price, each from its start. */
  price: PriceOffer[]
  /** What they take off a unit now, as Medusa's cart computes it. */
  discount: Kurus
  /** A cart offer to name beside the price; null: none. */
  cart: CartOffer | null
}

interface VariantRow {
  id: string
  product?: {
    id: string
    discountable?: boolean | null
    collection_id?: string | null
    type_id?: string | null
    categories?: ({ id: string } | null)[] | null
    tags?: ({ id: string } | null)[] | null
  } | null
}

interface ItemAdjustment {
  action: string
  item_id?: string
  code?: string
  amount?: MedusaAmount
}

const RULE = ["attribute", "operator", "values.value"]

// Any minimum a cart offer asks is met in the reading: its target products are what it tells
const ANY_CART = 1_000_000_000

/** The shop's automatic promotions that may show before the cart, by code. */
async function shownOffers(container: Resolver, currency: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "promotion",
    fields: [
      "code",
      "type",
      "status",
      "is_automatic",
      "is_tax_inclusive",
      "created_at",
      ...RULE.map((field) => `rules.${field}`),
      "application_method.type",
      "application_method.target_type",
      "application_method.allocation",
      "application_method.value",
      "application_method.max_quantity",
      "application_method.currency_code",
      "application_method.buy_rules_min_quantity",
      "campaign.starts_at",
      "campaign.budget.type",
    ],
    filters: { is_automatic: true, status: "active" },
  })
  const offers = new Map<string, Offer>()
  for (const row of data as PromotionRow[]) {
    const offer = offerOf(row, currency)
    if (offer) {
      offers.set(offer.code, offer)
    }
  }
  return offers
}

/**
 * The automatic promotions on each variant at its selling price now, for
 * a shopper with no customer and a cart holding one of it: Medusa's own
 * promotion module decides which apply (status, dates, limits, budget,
 * target products), as it will in the cart. A variant no offer touches
 * is not in the answer.
 */
export async function automaticOffers(
  container: Resolver,
  prices: ReadonlyMap<string, Kurus>,
  currency: string
): Promise<Map<string, VariantOffers>> {
  const found = new Map<string, VariantOffers>()
  if (prices.size === 0) {
    return found
  }
  const offers = await shownOffers(container, currency)
  if (offers.size === 0) {
    return found
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: [
      "id",
      "product.id",
      "product.discountable",
      "product.collection_id",
      "product.type_id",
      "product.categories.id",
      "product.tags.id",
    ],
    filters: { id: [...prices.keys()] },
  })
  const items = (data as VariantRow[]).flatMap((variant): ComputeActionItemLine[] => {
    const price = prices.get(variant.id)
    const product = variant.product
    if (price === undefined || !product) {
      return []
    }
    const amount = toMedusaAmount(price)
    return [
      {
        id: variant.id,
        variant_id: variant.id,
        quantity: 1,
        unit_price: amount,
        subtotal: amount,
        original_total: amount,
        is_discountable: product.discountable !== false,
        product: {
          id: product.id,
          ...(product.collection_id ? { collection_id: product.collection_id } : {}),
          ...(product.type_id ? { type_id: product.type_id } : {}),
          categories: (product.categories ?? []).flatMap((each) => (each ? [{ id: each.id }] : [])),
          tags: (product.tags ?? []).flatMap((each) => (each ? [{ id: each.id }] : [])),
        },
      },
    ]
  })
  const context: ComputeActionContext = {
    currency_code: currency,
    item_total: ANY_CART,
    items,
    shipping_methods: [],
  }
  const actions = (await container
    .resolve(Modules.PROMOTION)
    .computeActions([], context)) as unknown as ItemAdjustment[]
  const taken = new Map<string, MedusaAmount>()
  for (const action of actions) {
    const offer = action.code ? offers.get(action.code) : undefined
    if (action.action !== "addItemAdjustment" || !action.item_id || !offer) {
      continue
    }
    const entry = found.get(action.item_id) ?? { price: [], discount: kurus(0), cart: null }
    if (offer.kind === "price") {
      entry.price.push(offer)
      taken.set(action.item_id, MathBN.add(taken.get(action.item_id) ?? 0, action.amount ?? 0))
    } else {
      entry.cart ??= offer
    }
    found.set(action.item_id, entry)
  }
  // Medusa's exact amounts, summed, then rounded to the kuruş once, as the cart's total is
  for (const [id, amount] of taken) {
    const entry = found.get(id)
    if (entry) {
      entry.discount = fromMedusaAmount(amount, { allowRounding: true })
    }
  }
  return found
}
