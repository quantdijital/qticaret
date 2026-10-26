import type { ExecArgs } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv } from "../lib/env"
import { seedDemoOrders } from "./seed/orders"

/**
 * Usage: pnpm --filter @qticaret/backend seed:demo-orders [append] [days=N]
 *
 * About 90 days (or N, 1 to 90) of demo orders for the dashboard, on a development database
 * that has the demo catalog (seed:demo) and no orders yet. Never outside
 * development or test: the orders carry made-up names, and their dates are
 * moved with a direct UPDATE.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv())) {
    throw new Error("seed: demo orders are for development databases only")
  }
  // `append`: add to a database that already has orders (a run cut short);
  // `days=N`: fewer days, as CI's end-to-end tests need only a few orders
  const days = Number(args.find((arg) => arg.startsWith("days="))?.slice("days=".length) ?? 90)
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("seed: days must be a whole number from 1 to 90")
  }
  await seedDemoOrders(container, { append: args.includes("append"), days })
}
