import type { ExecArgs } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv } from "../lib/env"
import { seedDemoOrders } from "./seed/orders"

/**
 * Usage: pnpm --filter @qticaret/backend seed:demo-orders [append]
 *
 * About 90 days of demo orders for the dashboard, on a development database
 * that has the demo catalog (seed:demo) and no orders yet. Never outside
 * development or test: the orders carry made-up names, and their dates are
 * moved with a direct UPDATE.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv())) {
    throw new Error("seed: demo orders are for development databases only")
  }
  // `append`: add to a database that already has orders (a run cut short)
  await seedDemoOrders(container, { append: args.includes("append") })
}
