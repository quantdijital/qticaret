import type { MedusaRequest } from "@medusajs/framework/http"
import { capabilitiesOf } from "../../../lib/staff/permissions"
import { staffRoleOf } from "../../http/staff-guard"

/**
 * Whether the caller holds the looks (adr/0064, the owner 2026-11-23): only
 * they may have the oldest automatic saves removed when a discard or a
 * restore keeps another. Anyone else (an admin, a role-less user) keeps the
 * replaced draft without touching the owner's.
 */
export async function ownsLooks(req: MedusaRequest): Promise<boolean> {
  const role = await staffRoleOf(req)
  return role ? capabilitiesOf(role).looks : false
}
