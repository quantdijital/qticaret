import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logging"
import { removeStaffMemberWorkflow } from "../workflows/staff/remove-member"
import { E2E_STAFF_EMAIL } from "./demo-removal/select"

/**
 * Removes the admin an e2e run made, with its role and login (`NODE_ENV=development
 * medusa exec ./src/scripts/remove-e2e-admin.ts <email>`). A user cannot delete
 * itself through the API; anything but an address the panel's e2e setup
 * makes (apps/panel/e2e/support/admin.ts) is refused.
 */
export default async function removeE2eAdmin({ container, args }: ExecArgs) {
  const email = args[0] ?? ""
  if (!E2E_STAFF_EMAIL.test(email)) {
    throw new Error("remove-e2e-admin: not an e2e admin address")
  }
  const [user] = await container.resolve(Modules.USER).listUsers({ email }, { select: ["id"] })
  if (!user) {
    return
  }
  await removeStaffMemberWorkflow(container).run({ input: { user_id: user.id } })
  logger.info({ event: "e2e.admin_removed" })
}
