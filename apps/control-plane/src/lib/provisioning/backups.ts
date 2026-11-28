import type { MedusaContainer } from "@medusajs/framework/types"
import type { BackupSeen } from "../../modules/provisioning/service"
import { provisioningIn } from "../../workflows/modules"

/**
 * A shop's "Son yedek" as the API shows it (audit 3.2): when, how big,
 * whether it went, and why not. The manifest's name, sha256 and row counts
 * stay on the run and in the backup's folder.
 */
export const backupView = (seen: BackupSeen | undefined) =>
  seen
    ? {
        status: seen.status,
        at: seen.at,
        bytes: seen.bytes,
        files: seen.files,
        error_code: seen.error_code,
        run_id: seen.run_id,
      }
    : null

export type BackupView = ReturnType<typeof backupView>

/** These shops' latest backups, by id (absent: never backed up). */
export async function latestBackupViews(
  container: Pick<MedusaContainer, "resolve">,
  tenantIds: readonly string[]
) {
  const out = new Map<string, NonNullable<BackupView>>()
  for (const [id, seen] of await provisioningIn(container).latestBackups(tenantIds)) {
    const view = backupView(seen)
    if (view) {
      out.set(id, view)
    }
  }
  return out
}
