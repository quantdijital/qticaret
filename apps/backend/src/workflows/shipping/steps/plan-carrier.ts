import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { COD_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import { carrierOf, isCarrierProvider } from "../../../lib/shipping/carriers"
import type { CarrierName } from "../../../lib/shipping/carriers"

/** Who carries the order's parcel, from where, and what the courier collects. */
export interface CarrierPlan {
  /** A carrier we open shipments with; null for the manual provider (the shop ships itself). */
  carrier: CarrierName | null
  location_id: string | null
  /** Kuruş collected at the door: the authorized, uncaptured cash-on-delivery payment. */
  cash_on_delivery: number | null
}

interface OrderRow {
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
  fulfillments?: ({ provider_id?: string | null; canceled_at?: unknown } | null)[] | null
  payment_collections?:
    | ({
        payments?:
          | ({
              provider_id: string
              amount?: MedusaAmount
              raw_amount?: MedusaAmount
              captured_at?: unknown
              canceled_at?: unknown
            } | null)[]
          | null
      } | null)[]
    | null
}

interface OptionRow {
  provider_id?: string | null
  service_zone?: { fulfillment_set?: { location?: { id: string } | null } | null } | null
}

/**
 * Reads how the order ships (adr/0031): the provider of its shipping
 * option and the warehouse behind it, and whether its courier collects a
 * cash-on-delivery payment (adr/0029). The courier collects the whole
 * payment with one parcel: an order paid at the door goes with a carrier
 * in one parcel only. Reads only.
 */
export const planCarrierStep = createStep(
  "shipping-plan-carrier",
  async (input: { order_id: string; partial: boolean }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "shipping_methods.shipping_option_id",
        "fulfillments.provider_id",
        "fulfillments.canceled_at",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.amount",
        "payment_collections.payments.raw_amount",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: input.order_id },
    })
    const order = data[0] as OrderRow | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
    }
    const optionId = (order.shipping_methods ?? []).find(
      (method) => method?.shipping_option_id
    )?.shipping_option_id
    let option: OptionRow | undefined
    if (optionId) {
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["provider_id", "service_zone.fulfillment_set.location.id"],
        filters: { id: optionId },
      })
      option = options[0]
    }
    const cod = (order.payment_collections ?? [])
      .flatMap((collection) => collection?.payments ?? [])
      .find(
        (payment) =>
          payment?.provider_id === COD_PAYMENT_PROVIDER_ID &&
          !payment.captured_at &&
          !payment.canceled_at
      )
    const carrier = carrierOf(option?.provider_id)
    const carried = (order.fulfillments ?? []).some(
      (fulfillment) =>
        fulfillment && !fulfillment.canceled_at && isCarrierProvider(fulfillment.provider_id)
    )
    // Money at stake: a second parcel would be collected again, a part alone would be under-collected
    if (carrier && cod && (input.partial || carried)) {
      throw new ValidationError("shipping.cod_single_parcel")
    }
    let locationId = option?.service_zone?.fulfillment_set?.location?.id ?? null
    if (!locationId) {
      // The option names no warehouse (or the order has none): the shop's only one (adr/0054
      // addendum). Never a guess among several: the stock taken from it must be where it is kept
      const { data: locations } = await query.graph({
        entity: "stock_location",
        fields: ["id"],
        pagination: { take: 2 },
      })
      locationId = locations.length === 1 ? (locations[0] as { id: string }).id : null
    }
    return new StepResponse<CarrierPlan>({
      carrier,
      location_id: locationId,
      cash_on_delivery: cod
        ? fromMedusaAmount(cod.raw_amount ?? cod.amount ?? 0, { allowRounding: true })
        : null,
    })
  }
)
