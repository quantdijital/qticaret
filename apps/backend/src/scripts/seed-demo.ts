import type { ExecArgs } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv } from "../lib/env"
import { seedDemo } from "./seed"

const ALLOW_FLAG = "--allow-non-local"

/**
 * Usage: pnpm --filter @qticaret/backend seed:demo [--allow-non-local]
 *
 * The demo products are published, priced and in stock, so customers could
 * buy them. Outside development/test the seed runs only with the explicit
 * flag, meant for demo tenants.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv()) && !args.includes(ALLOW_FLAG)) {
    throw new Error(
      `seed: refusing to add demo products outside development/test; pass ${ALLOW_FLAG} for a demo tenant`
    )
  }
  await seedDemo(container)
}
