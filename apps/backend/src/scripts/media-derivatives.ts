import type { ExecArgs } from "@medusajs/framework/types"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { backfillMediaVersions } from "../workflows/media/backfill"

/**
 * Usage: pnpm --filter @qticaret/backend media:derivatives [apply]
 *
 * The WebP/AVIF versions of pictures stored before every upload got them
 * (docs/21 2026-11-06, open item 1): category covers, post and page covers,
 * authors' photos, pictures in texts, migrated covers. A picture no product
 * holds gets versions named after itself; a product's picture goes through
 * its product's run (named after the product, adr/0016). A batch at a time;
 * a picture with versions is skipped, so a stopped run goes on where it
 * was and a second run makes none. Without `apply` nothing is made or
 * written: the counts say what would be. Prints counts only.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const apply = args.includes("apply")
  const counts = await backfillMediaVersions(container, { apply })
  if (apply && counts.missing > 0) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "media.versions_backfilled",
      actor_type: "system",
      actor_id: null,
      resource_type: "media_asset",
      resource_id: null,
      changes: { ...counts },
    })
  }
  process.stdout.write(
    `media:derivatives: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}\n`
  )
}
