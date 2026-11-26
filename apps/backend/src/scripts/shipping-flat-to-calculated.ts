import type { ExecArgs } from "@medusajs/framework/types"
import shippingFlatToCalculated from "../migration-scripts/shipping-flat-to-calculated"

/**
 * adr/0087 §7, again by hand: `pnpm --filter backend medusa exec
 * ./src/scripts/shipping-flat-to-calculated.ts`. Safe to repeat: an
 * option already moved is left as it is.
 */
export default async function run(args: ExecArgs) {
  await shippingFlatToCalculated(args)
}
