import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"

/**
 * The shop's 2FA requirement from the server's shell (`medusa exec
 * ./src/scripts/set-staff-mfa.ts on|off`), for a shop whose owner cannot
 * reach Settings > Security. Recorded as the system's.
 */
export default async function setStaffMfa({ container, args }: ExecArgs) {
  const value = args[0]
  if (value !== "on" && value !== "off") {
    throw new Error("set-staff-mfa: on or off")
  }
  await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .saveSection("security", { staff_mfa_required: value === "on" }, null)
  await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
    kind: "system",
    action: "staff.mfa_requirement_set",
    actor_type: "system",
    resource_type: "platform_settings",
    resource_id: "security",
    changes: { staff_mfa_required: value === "on" },
  })
  logger.info({ event: "staff.mfa_requirement_set", required: value === "on" })
}
