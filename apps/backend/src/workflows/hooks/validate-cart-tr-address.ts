import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCartWorkflow, updateCartWorkflow } from "@medusajs/medusa/core-flows"
import type { AddressFields } from "../../modules/tr-address/validation"
import { refusePlainDatedItems } from "../booking/cart/plain-items"
import { assertTrAddresses } from "../tr-address/assert-tr-addresses"

/**
 * Second line of defence for F1.4: the Store API middleware already rejects
 * bad Turkish addresses with field-level issues; these hooks also cover
 * carts created or updated by other workflows.
 */

type AddressInput = AddressFields | string | null | undefined

// A string is an existing address id; customer addresses are checked when
// saved (validate-customer-address-tr-address.ts).
const asFields = (value: AddressInput): AddressFields | undefined =>
  value && typeof value === "object" ? value : undefined

createCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const addresses: [string, AddressFields][] = []
  const shipping = asFields(input.shipping_address)
  const billing = asFields(input.billing_address)
  if (shipping) {
    addresses.push(["shipping_address", shipping])
  }
  if (billing) {
    addresses.push(["billing_address", billing])
  }
  await assertTrAddresses(container, addresses)
  // adr/0076 §5: a dated product's variant is added only through its booking route
  await refusePlainDatedItems(container, input.items)
})

updateCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const shipping = asFields(input.shipping_address)
  const billing = asFields(input.billing_address)
  if (!shipping && !billing) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["shipping_address.*", "billing_address.*"],
    filters: { id: input.id },
  })
  const stored = data[0] as
    { shipping_address?: AddressFields | null; billing_address?: AddressFields | null } | undefined
  // Partial updates are checked merged over the stored address
  const addresses: [string, AddressFields][] = []
  if (shipping) {
    addresses.push(["shipping_address", { ...(stored?.shipping_address ?? {}), ...shipping }])
  }
  if (billing) {
    addresses.push(["billing_address", { ...(stored?.billing_address ?? {}), ...billing }])
  }
  await assertTrAddresses(container, addresses)
})
