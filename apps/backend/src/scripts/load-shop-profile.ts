import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv } from "../lib/env"
import { applyProfile } from "./shop-profile/apply"
import { hideDemoCategories } from "./shop-profile/demo"
import { readProfile } from "./shop-profile/profile"

// `medusa exec` refuses `--options` it does not know; plain arguments pass
const ALLOW_FLAG = "allow-non-local"
const HIDE_DEMO = "hide-demo"

/**
 * Usage: pnpm --filter @qticaret/backend shop:profile <folder> [hide-demo] [allow-non-local]
 *
 * Loads a shop profile (`<folder>/profil.json`, F18): the shop's name,
 * settings sections, content pages and a migration bundle. `hide-demo`
 * takes the demo seed's categories off the storefront (they stay, inactive).
 * Outside development/test only with the explicit flag, for a new tenant.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv()) && !args.includes(ALLOW_FLAG)) {
    throw new Error(`shop profile: refusing outside development/test; pass ${ALLOW_FLAG}`)
  }
  const folder = args.find((arg) => arg !== ALLOW_FLAG && arg !== HIDE_DEMO)
  if (!folder) {
    throw new Error("shop profile: name the profile's folder")
  }
  const loaded = await readProfile(path.resolve(folder))
  await applyProfile(container, loaded)
  if (args.includes(HIDE_DEMO)) {
    await hideDemoCategories(container)
  }
}
