import type { ExecArgs } from "@medusajs/framework/types"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { fillBrandLogoSizes } from "../workflows/brands/backfill-logo-sizes"

/**
 * Usage: pnpm --filter @qticaret/backend brand-logo-sizes:backfill [apply]
 *
 * Brand logos' width and height for brands whose logo was set before the
 * sizes were kept: each brand with a logo and no size gets the size its
 * file has (the media library's record, else the file's header), so the
 * storefront can save the logo's room before it loads. Run once after the
 * `brands` migration. Without `apply` nothing is written: the counts say
 * what would be. Safe to run again (a brand with a size is left alone).
 * Prints the counts and the ids of brands whose logo could not be measured
 * (they are drawn as before).
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const out = (line: string) => process.stdout.write(`${line}\n`)
  const apply = args.includes("apply")
  const result = await fillBrandLogoSizes(container, { apply })
  const counts = {
    missing: result.missing,
    measured: result.measured,
    unmeasured: result.unmeasured.length,
    written: result.written,
  }
  if (apply && result.written > 0) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "brands.logo_sizes_backfilled",
      actor_type: "system",
      actor_id: null,
      resource_type: "brand",
      resource_id: null,
      changes: counts,
    })
  }
  out(
    `brand-logo-sizes:backfill: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}`
  )
  for (const id of result.unmeasured) {
    out(`  UNMEASURED ${id}`)
  }
}
