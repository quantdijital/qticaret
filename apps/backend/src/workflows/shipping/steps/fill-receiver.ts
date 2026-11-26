import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { logger } from "../../../lib/logging"
import { filledReceiver } from "../../../lib/shipping/fill"
import type { FilledAddress, Person } from "../../../lib/shipping/fill"
import type { AddressRow } from "../../../lib/shipping/address"
import { placeFactsOf } from "../place-facts"

interface OrderRow {
  display_id?: number | null
  shipping_address?: AddressRow | null
  billing_address?: AddressRow | null
  customer?: Person | null
}

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "phone",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
]

/**
 * The receiver a carrier gets for the order's parcel (adr/0054, 2026-11-05
 * addendum): the delivery address with what the order already knows put
 * in its gaps (`lib/shipping/fill`): the billing address's or the
 * account's name and phone, the postcode and plate code from the address
 * data. The order's own address is not changed. Reads only.
 */
export const fillReceiverStep = createStep(
  "shipping-fill-receiver",
  async (input: { order_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "display_id",
        ...ADDRESS_FIELDS.map((field) => `shipping_address.${field}`),
        ...ADDRESS_FIELDS.map((field) => `billing_address.${field}`),
        "customer.first_name",
        "customer.last_name",
        "customer.phone",
      ],
      filters: { id: input.order_id },
    })
    const order = data[0] as OrderRow | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
    }
    const receiver = filledReceiver(order.shipping_address, {
      billing: order.billing_address,
      customer: order.customer,
      place: await placeFactsOf(container, order.shipping_address),
    })
    if (receiver.filled.length > 0) {
      // The parts, never their values (docs/04: no personal data in logs)
      logger.info({
        event: "shipping.receiver_filled",
        orderDisplayId: order.display_id ?? null,
        fields: receiver.filled,
      })
    }
    return new StepResponse<FilledAddress>(receiver)
  }
)
