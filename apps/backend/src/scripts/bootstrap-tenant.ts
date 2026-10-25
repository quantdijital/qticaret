import type { ExecArgs } from "@medusajs/framework/types"
import { bootstrapTenant } from "./bootstrap"
import { ensureStoreName, storeNameArg } from "./bootstrap/store-name"

/**
 * Usage: pnpm --filter @qticaret/backend tenant:bootstrap store-name="Mağaza Adı"
 *
 * Provisioning asks the shop's name and passes it here (docs/17); a store
 * still carrying Medusa's default name is not set up without it. Reruns may
 * leave it out.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  await ensureStoreName(container, storeNameArg(args))
  await bootstrapTenant(container)
}
