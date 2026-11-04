import type { ExecArgs } from "@medusajs/framework/types"
import { bootstrapTenant } from "./bootstrap"
import { ensureStoreName, storeNameArg } from "./bootstrap/store-name"
import { ensureTrAddressData } from "./tr-address/ensure"

/**
 * Usage: pnpm --filter @qticaret/backend tenant:bootstrap store-name="Mağaza Adı"
 *
 * Provisioning asks the shop's name and passes it here (docs/17); a store
 * still carrying Medusa's default name is not set up without it. Reruns may
 * leave it out. A new shop also gets the country's address data from
 * TürkiyeAPI (adr/0008 Ek 2026-11-04; skipped with a warning offline).
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  await ensureStoreName(container, storeNameArg(args))
  await bootstrapTenant(container)
  await ensureTrAddressData(container)
}
