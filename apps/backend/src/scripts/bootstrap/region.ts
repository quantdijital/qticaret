import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRegionsWorkflow } from "@medusajs/medusa/core-flows"
import {
  SYSTEM_PAYMENT_PROVIDER_ID,
  TRY_CURRENCY_CODE,
  TR_COUNTRY_CODE,
  TR_REGION_NAME,
} from "./constants"

/**
 * Returns the id of the region that holds Turkey, creating it on first run.
 * A country belongs to at most one region, so an existing one is reused as
 * is: the tenant may have edited it in the admin since.
 */
export async function ensureTrRegion(container: MedusaContainer): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: countries } = await query.graph({
    entity: "country",
    fields: ["iso_2", "region_id"],
    filters: { iso_2: TR_COUNTRY_CODE },
  })
  const existingId = countries[0]?.region_id
  if (existingId) {
    logger.info(`bootstrap: region for ${TR_COUNTRY_CODE} exists, keeping it`)
    return existingId
  }

  const { result } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: TR_REGION_NAME,
          currency_code: TRY_CURRENCY_CODE,
          countries: [TR_COUNTRY_CODE],
          automatic_taxes: true,
          is_tax_inclusive: true,
          payment_providers: [SYSTEM_PAYMENT_PROVIDER_ID],
        },
      ],
    },
  })
  const region = result[0]
  if (!region) {
    throw new Error("bootstrap: createRegionsWorkflow returned no region")
  }
  logger.info(`bootstrap: created region ${region.id}`)
  return region.id
}
