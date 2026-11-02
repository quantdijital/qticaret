import type { ExecArgs } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv } from "../lib/env"
import { removeDemo } from "./demo-removal"

// `medusa exec` refuses `--options` it does not know; plain arguments pass
const ALLOW_FLAG = "allow-non-local"

/**
 * Usage: pnpm --filter @qticaret/backend demo:remove [allow-non-local]
 *
 * Takes the demo catalog and orders (seed:demo, seed:demo-orders) and what
 * e2e runs left out of the database, so the shop owner sees only their
 * own records. Outside development/test it runs only with the explicit
 * flag, meant for a demo tenant handed over to its shop.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv()) && !args.includes(ALLOW_FLAG)) {
    throw new Error(
      `demo:remove: refusing to remove records outside development/test; pass ${ALLOW_FLAG} for a demo tenant`
    )
  }
  await removeDemo(container)
}
