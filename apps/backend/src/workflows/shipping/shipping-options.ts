import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount, toMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import {
  GELIVER_FULFILLMENT_PROVIDER_ID,
  MANUAL_FULFILLMENT_PROVIDER_ID,
} from "../../lib/shipping/carriers"

/**
 * The shop's shipping options as the panel keeps them (F7.8, adr/0031):
 * a name shoppers see, who carries the parcel (the shop itself, Geliver,
 * or the shopper from the shop: pickup) and how it is priced (a flat
 * amount, Geliver's quote, or the shop's table). They live in the default
 * warehouse's Türkiye zone (a pickup zone for pickup), made when missing.
 */

export type OptionPricing =
  | { type: "flat"; amount: Kurus }
  | { type: "quote"; choice: "cheapest" | "fastest" }
  | { type: "table" }

export type OptionCarrier = "manual" | "geliver" | "pickup"

export interface ShopOptionInput {
  name: string
  carrier: OptionCarrier
  pricing: OptionPricing
}

type SetType = "shipping" | "pickup"

// Medusa keeps fulfillment set and service zone names unique: one of each per kind
const SET_NAMES: Readonly<Record<SetType, string>> = {
  shipping: "Gönderiler",
  pickup: "Mağazadan teslim",
}
const ZONE_NAMES: Readonly<Record<SetType, string>> = {
  shipping: "Türkiye",
  pickup: "Türkiye (mağazadan teslim)",
}

interface LocationRow {
  fulfillment_sets?:
    | ({
        id: string
        type?: string | null
        service_zones?:
          | ({
              id: string
              geo_zones?: ({ country_code?: string | null } | null)[] | null
            } | null)[]
          | null
      } | null)[]
    | null
}

async function zoneOf(container: MedusaContainer, locationId: string, type: SetType) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "stock_location",
    fields: [
      "fulfillment_sets.id",
      "fulfillment_sets.type",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.geo_zones.country_code",
    ],
    filters: { id: locationId },
  })
  const sets = ((data[0] as LocationRow | undefined)?.fulfillment_sets ?? []).filter(
    (set): set is NonNullable<typeof set> => set?.type === type
  )
  const zone = sets
    .flatMap((set) => set.service_zones ?? [])
    .find((each) => (each?.geo_zones ?? []).some((geo) => geo?.country_code === "tr"))
  return { set: sets[0] ?? null, zone_id: zone?.id ?? null }
}

/**
 * Where the shop's options live: the default warehouse's zone for
 * Türkiye of the kind asked (shipping, or pickup), and the default
 * shipping profile. Made when missing (kept if the option then fails: an
 * empty zone harms nothing).
 */
export const ensureShippingZoneStep = createStep(
  "shipping-ensure-zone",
  async (input: { type: SetType }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [{ data: stores }, { data: profiles }] = await Promise.all([
      query.graph({ entity: "store", fields: ["default_location_id", "default_region_id"] }),
      query.graph({ entity: "shipping_profile", fields: ["id"], filters: { type: "default" } }),
    ])
    const store = stores[0] as
      { default_location_id?: string | null; default_region_id?: string | null } | undefined
    const locationId = store?.default_location_id
    const profileId = (profiles[0] as { id: string } | undefined)?.id
    if (!locationId || !profileId) {
      throw new ValidationError("shipping.setup_incomplete")
    }
    let found = await zoneOf(container, locationId, input.type)
    if (!found.set) {
      await createLocationFulfillmentSetWorkflow(container).run({
        input: {
          location_id: locationId,
          fulfillment_set_data: { name: SET_NAMES[input.type], type: input.type },
        },
      })
      found = await zoneOf(container, locationId, input.type)
    }
    if (!found.zone_id && found.set) {
      await createServiceZonesWorkflow(container).run({
        input: {
          data: [
            {
              fulfillment_set_id: found.set.id,
              name: ZONE_NAMES[input.type],
              geo_zones: [{ type: "country", country_code: "tr" }],
            },
          ],
        },
      })
      found = await zoneOf(container, locationId, input.type)
    }
    if (!found.zone_id) {
      throw new ValidationError("shipping.setup_incomplete")
    }
    return new StepResponse({
      service_zone_id: found.zone_id,
      shipping_profile_id: profileId,
      region_id: store.default_region_id ?? null,
    })
  }
)

const GELIVER_DATA: Readonly<Record<string, string>> = {
  cheapest: "geliver-cheapest",
  fastest: "geliver-fastest",
}

/** Medusa's shipping option for the shop's choice of carrier and price. */
export function shippingOptionInput(
  input: ShopOptionInput,
  place: { service_zone_id: string; shipping_profile_id: string; region_id: string | null }
) {
  const { pricing } = input
  // Only Geliver quotes or prices by the table; the shop's own parcels and pickup take a flat price
  if (input.carrier !== "geliver" && pricing.type !== "flat") {
    throw new ValidationError("shipping.manual_flat_only", { field: "pricing" })
  }
  const data =
    input.carrier === "geliver"
      ? {
          id:
            pricing.type === "table"
              ? "geliver-table"
              : GELIVER_DATA[pricing.type === "quote" ? pricing.choice : "cheapest"],
        }
      : {}
  return {
    name: input.name,
    service_zone_id: place.service_zone_id,
    shipping_profile_id: place.shipping_profile_id,
    provider_id:
      input.carrier === "geliver"
        ? GELIVER_FULFILLMENT_PROVIDER_ID
        : MANUAL_FULFILLMENT_PROVIDER_ID,
    data,
    type: { label: input.name, description: input.name, code: input.carrier },
    rules: [
      { attribute: "enabled_in_store", operator: "eq" as const, value: "true" },
      { attribute: "is_return", operator: "eq" as const, value: "false" },
    ],
    ...(pricing.type === "flat"
      ? {
          price_type: "flat" as const,
          // By currency, and by the shop's region as Medusa's own seed does
          prices: [
            { currency_code: "try", amount: Number(toMedusaAmount(pricing.amount)) },
            ...(place.region_id
              ? [{ region_id: place.region_id, amount: Number(toMedusaAmount(pricing.amount)) }]
              : []),
          ],
        }
      : { price_type: "calculated" as const }),
  }
}

export const createShopShippingOptionWorkflow = createWorkflow(
  "shipping-create-shop-option",
  (input: ShopOptionInput) => {
    const place = ensureShippingZoneStep(
      transform({ input }, ({ input }) => ({
        type: input.carrier === "pickup" ? ("pickup" as const) : ("shipping" as const),
      }))
    )
    const created = createShippingOptionsWorkflow.runAsStep({
      input: transform({ input, place }, ({ input, place }) => [shippingOptionInput(input, place)]),
    })
    return new WorkflowResponse(transform({ created }, ({ created }) => created[0]?.id ?? ""))
  }
)

/** A new name, or a flat option's new amount. */
export const updateShopShippingOptionWorkflow = createWorkflow(
  "shipping-update-shop-option",
  (input: { id: string; name?: string | undefined; amount?: Kurus | undefined }) => {
    updateShippingOptionsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => [
        {
          id: input.id,
          ...(input.name ? { name: input.name } : {}),
          ...(input.amount === undefined
            ? {}
            : { prices: [{ currency_code: "try", amount: Number(toMedusaAmount(input.amount)) }] }),
        },
      ]),
    })
    return new WorkflowResponse(input.id)
  }
)

interface OptionRow {
  id: string
  name: string
  provider_id?: string | null
  price_type?: string | null
  data?: Record<string, unknown> | null
  prices?: ({ currency_code?: string | null; amount?: MedusaAmount } | null)[] | null
  rules?: ({ attribute?: string | null; value?: unknown } | null)[] | null
  service_zone?: { fulfillment_set?: { type?: string | null } | null } | null
}

const ruleIs = (option: OptionRow, attribute: string, value: string) =>
  (option.rules ?? []).some(
    (rule) => rule?.attribute === attribute && JSON.stringify(rule.value).includes(value)
  )

/** The shop's options as the panel lists them: sending, not returns; amounts as lira. */
export async function shopShippingOptions(container: MedusaContainer) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "provider_id",
      "price_type",
      "data",
      "prices.currency_code",
      "prices.amount",
      "rules.attribute",
      "rules.value",
      "service_zone.fulfillment_set.type",
    ],
  })
  return (data as unknown as OptionRow[])
    .filter((option) => !ruleIs(option, "is_return", "true"))
    .map((option) => {
      const geliver = option.provider_id === GELIVER_FULFILLMENT_PROVIDER_ID
      const price = (option.prices ?? []).find((each) => each?.currency_code === "try")
      const choice = option.data?.["id"]
      return {
        id: option.id,
        name: option.name,
        carrier: geliver
          ? ("geliver" as const)
          : option.service_zone?.fulfillment_set?.type === "pickup"
            ? ("pickup" as const)
            : option.provider_id === MANUAL_FULFILLMENT_PROVIDER_ID
              ? ("manual" as const)
              : null,
        pricing:
          option.price_type === "flat"
            ? ("flat" as const)
            : choice === "geliver-table"
              ? ("table" as const)
              : choice === "geliver-fastest"
                ? ("fastest" as const)
                : ("cheapest" as const),
        amount:
          option.price_type === "flat" && price?.amount !== undefined
            ? toMedusaAmount(fromMedusaAmount(price.amount, { allowRounding: true }))
            : null,
        in_store: ruleIs(option, "enabled_in_store", "true"),
      }
    })
}
