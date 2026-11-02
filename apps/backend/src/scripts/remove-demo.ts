import type { ExecArgs } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv } from "../lib/env"
import {
  ALLOW_FLAG,
  CONFIRM_FLAG,
  applyDemoRemoval,
  demoRemovalMode,
  describeDemoPlan,
  logDemoPlan,
  planDemoRemoval,
} from "./demo-removal"

/**
 * Usage: pnpm --filter @qticaret/backend demo:remove [allow-non-local [confirm]]
 *
 * Takes the demo catalog and orders (seed:demo, seed:demo-orders) and what
 * e2e runs left out of the database, so the shop owner sees only their
 * own records; it lists every record first. Outside development/test (a
 * demo tenant handed over to its shop) it reads only with `allow-non-local`
 * and then stops after the list; run again with `confirm` as well to
 * remove. `medusa exec` refuses `--options` it does not know: plain
 * arguments pass.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const mode = demoRemovalMode(isLocalEnv(parseEnv()), args)
  if (mode === "refuse") {
    throw new Error(
      `demo:remove: refusing to remove records outside development/test; pass ${ALLOW_FLAG} for a demo tenant`
    )
  }
  const plan = await planDemoRemoval(container)
  logDemoPlan(plan)
  if (mode === "list_only") {
    throw new Error(
      `demo:remove: nothing removed; read the ${String(describeDemoPlan(plan).length)} records listed above, then run again with ${ALLOW_FLAG} ${CONFIRM_FLAG}`
    )
  }
  await applyDemoRemoval(container, plan)
}
