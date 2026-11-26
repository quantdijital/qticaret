import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { ensureLocationCarriers } from "../scripts/bootstrap/location-carriers"
import { convertFlatShippingOptionsWorkflow } from "../workflows/shipping/flat-to-calculated"

/**
 * Runs once per shop, on the `db:migrate` that brings per-product free
 * shipping (adr/0087 §7): our flat-price provider joins the default
 * warehouse, then every flat-rate option moves to our pricing. The
 * workflow finds nothing to do a second time (`pnpm --filter backend
 * medusa exec ./src/scripts/shipping-flat-to-calculated.ts` runs it again).
 */
export default async function shippingFlatToCalculated({ container }: ExecArgs) {
  await ensureLocationCarriers(container)
  const { result } = await convertFlatShippingOptionsWorkflow(container).run()
  logger.info({ event: "shipping.flat_options_converted", count: result })
}
