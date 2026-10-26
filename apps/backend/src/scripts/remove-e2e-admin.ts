import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { removeUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../lib/logging"

// Only the addresses the panel's e2e setup makes (apps/panel/e2e/support/admin.ts)
const E2E_ADMIN = /^e2e-\d{13}-[0-9a-f]{6}@example\.com$/

/**
 * Removes the admin an e2e run made, with its login (`medusa exec
 * ./src/scripts/remove-e2e-admin.ts <email>`). A user cannot delete
 * itself through the API; anything but an e2e address is refused.
 */
export default async function removeE2eAdmin({ container, args }: ExecArgs) {
  const email = args[0] ?? ""
  if (!E2E_ADMIN.test(email)) {
    throw new Error("remove-e2e-admin: not an e2e admin address")
  }
  const [user] = await container.resolve(Modules.USER).listUsers({ email }, { select: ["id"] })
  if (!user) {
    return
  }
  await removeUserAccountWorkflow(container).run({ input: { userId: user.id } })
  logger.info({ event: "e2e.admin_removed" })
}
