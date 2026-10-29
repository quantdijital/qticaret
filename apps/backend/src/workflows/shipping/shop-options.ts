import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { fromMedusaAmount, toMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { MANUAL_FULFILLMENT_PROVIDER_ID, carrierOf } from "../../lib/shipping/carriers"

interface OptionRow {
  id: string
  name: string
  provider_id?: string | null
  price_type?: string | null
  data?: Record<string, unknown> | null
  prices?:
    | ({
        currency_code?: string | null
        amount?: MedusaAmount
        price_rules?: ({ attribute?: string | null } | null)[] | null
      } | null)[]
    | null
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
      "prices.price_rules.attribute",
      "rules.attribute",
      "rules.value",
      "service_zone.fulfillment_set.type",
    ],
  })
  return (data as unknown as OptionRow[])
    .filter((option) => !ruleIs(option, "is_return", "true"))
    .map((option) => {
      const carrier = carrierOf(option.provider_id)
      // The shop's own price, not the free one from a basket total (F4.5), which carries a rule
      const price = (option.prices ?? []).find(
        (each) =>
          each?.currency_code === "try" && !(each.price_rules ?? []).some((rule) => rule !== null)
      )
      const choice = option.data?.["id"]
      return {
        id: option.id,
        name: option.name,
        carrier:
          carrier ??
          (option.service_zone?.fulfillment_set?.type === "pickup"
            ? ("pickup" as const)
            : option.provider_id === MANUAL_FULFILLMENT_PROVIDER_ID
              ? ("manual" as const)
              : null),
        pricing:
          option.price_type === "flat"
            ? ("flat" as const)
            : typeof choice === "string" && choice.endsWith("-table")
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
