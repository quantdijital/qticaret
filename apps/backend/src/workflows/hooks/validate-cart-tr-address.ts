import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createCartWorkflow, updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { TR_ADDRESS_MODULE } from "../../modules/tr-address"
import type TrAddressModuleService from "../../modules/tr-address/service"
import type { AddressFields } from "../../modules/tr-address/validation"
import { validateTrAddress } from "../../modules/tr-address/validation"

/**
 * Second line of defence for F1.4: the Store API middleware already rejects
 * bad Turkish addresses with field-level issues; these hooks also cover
 * carts created or updated by other workflows.
 */

type AddressInput = AddressFields | string | null | undefined
const ADDRESS_KEYS = ["shipping_address", "billing_address"] as const

async function assertTrAddresses(
  container: MedusaContainer,
  addresses: Partial<Record<(typeof ADDRESS_KEYS)[number], AddressFields>>
): Promise<void> {
  const service = container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const codes: string[] = []
  for (const key of ADDRESS_KEYS) {
    const address = addresses[key]
    if (address) {
      const issues = await validateTrAddress(service, address)
      codes.push(...issues.map((issue) => `${key}.${issue.field}: ${issue.code}`))
    }
  }
  if (codes.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid Turkish address (${codes.join(", ")})`
    )
  }
}

// An address id (string) refers to a stored address that was validated when saved.
const asFields = (value: AddressInput): AddressFields | undefined =>
  value && typeof value === "object" ? value : undefined

createCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const shipping = asFields(input.shipping_address)
  const billing = asFields(input.billing_address)
  await assertTrAddresses(container, {
    ...(shipping ? { shipping_address: shipping } : {}),
    ...(billing ? { billing_address: billing } : {}),
  })
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
  const stored = data[0]
  await assertTrAddresses(container, {
    ...(shipping ? { shipping_address: { ...(stored?.shipping_address ?? {}), ...shipping } } : {}),
    ...(billing ? { billing_address: { ...(stored?.billing_address ?? {}), ...billing } } : {}),
  })
})
