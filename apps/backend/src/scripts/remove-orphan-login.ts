import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logging"

/**
 * Removes a login no one uses (`medusa exec ./src/scripts/remove-orphan-login.ts
 * <email>`), for support: anyone may register a login for any address, so
 * one made for an invited address before the invitee came blocks their
 * acceptance (security review F12 Y13). Only a login tied to no staff
 * member and no customer, for an address no user has, is removed; the
 * invitee then accepts as usual.
 */
export default async function removeOrphanLogin({ container, args }: ExecArgs) {
  const email = (args[0] ?? "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new Error("remove-orphan-login: an e-mail address is needed")
  }
  const users = await container.resolve(Modules.USER).listUsers({ email }, { select: ["id"] })
  if (users.length > 0) {
    throw new Error("remove-orphan-login: a user has this address; its login is in use")
  }
  const auth = container.resolve(Modules.AUTH)
  const [login] = await auth.listProviderIdentities(
    { provider: "emailpass", entity_id: email },
    { select: ["auth_identity_id"], take: 1 }
  )
  if (!login?.auth_identity_id) {
    logger.info({ event: "staff.orphan_login_none" })
    return
  }
  const identity = await auth.retrieveAuthIdentity(login.auth_identity_id)
  const tied = Object.entries(identity.app_metadata ?? {}).some(
    ([key, value]) => key.endsWith("_id") && Boolean(value)
  )
  if (tied) {
    throw new Error("remove-orphan-login: the login belongs to someone; nothing removed")
  }
  await auth.deleteAuthIdentities([identity.id])
  logger.info({ event: "staff.orphan_login_removed" })
}
