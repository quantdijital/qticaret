import type { ExecArgs } from "@medusajs/framework/types"
import { bootstrapTenant } from "./bootstrap"

/** Usage: pnpm --filter @qticaret/backend medusa exec ./src/scripts/bootstrap-tenant.ts */
export default async function run({ container }: ExecArgs): Promise<void> {
  await bootstrapTenant(container)
}
