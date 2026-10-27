import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../lib/logging"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../scripts/bootstrap/constants"

/**
 * Runs once per shop, on the `db:migrate` that brings PayTR (F5 V2): every
 * region gains PayTR next to the providers it has. Medusa replaces a
 * region's whole set when given one, so each region's own set is read and
 * kept. Without a stored account PayTR refuses to start a payment.
 */
export default async function paytrRegionProvider({ container }: ExecArgs) {
  const { data: regions } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "region",
    fields: ["id", "payment_providers.id"],
  })
  for (const region of regions as { id: string; payment_providers?: ({ id: string } | null)[] }[]) {
    const current = (region.payment_providers ?? []).flatMap((provider) =>
      provider ? [provider.id] : []
    )
    if (current.includes(PAYTR_PAYMENT_PROVIDER_ID)) {
      continue
    }
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: { payment_providers: [...current, PAYTR_PAYMENT_PROVIDER_ID] },
      },
    })
    logger.info({ event: "migration.paytr_region_provider", regionId: region.id })
  }
}
