import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { passwordProblem } from "@qticaret/server-kit"
import { inviteOfToken } from "../../workflows/cp-staff/invites"
import { rejectRequest } from "./request"

export const INVITE_HEADER = "x-cp-invite"

/**
 * `POST /auth/user/emailpass/register` (Ek C4, L1): Medusa lets anyone make
 * a login for any address. Here only the holder of a good invitation, for
 * its own address (header `x-cp-invite`, so the token stays out of the body
 * Medusa reads). A login someone made earlier for that address with no
 * user behind it (pre-registered by whoever, to take the account over) is
 * removed first: the invitation's holder sets the password. The password
 * meets the shop's rule (server-kit `passwordProblem`, adr/0043: 10 to 256
 * characters, not a common one, not the address's name; Ek C6): 400
 * `auth.password_<problem>`. The breach list is the shop's alone (it asks
 * an outside service); here the rule is offline.
 */
export async function gateRegistration(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const token = req.headers[INVITE_HEADER]
    const email = (req.body as { email?: unknown } | undefined)?.email
    const invite =
      typeof token === "string" && token !== ""
        ? await inviteOfToken(req.scope, token).catch(() => null)
        : null
    if (
      !invite ||
      typeof email !== "string" ||
      email.trim().toLowerCase() !== invite.email.trim().toLowerCase()
    ) {
      rejectRequest(
        req,
        res,
        403,
        { type: "not_allowed", message: "cp.register_closed" },
        "register_closed"
      )
      return
    }
    const password = (req.body as { password?: unknown }).password
    const problem = typeof password === "string" ? passwordProblem(password, email) : null
    if (problem) {
      const message = `auth.password_${problem}`
      rejectRequest(req, res, 400, { type: "invalid_data", message }, message)
      return
    }
    const auth = req.scope.resolve(Modules.AUTH)
    const logins = await auth.listProviderIdentities(
      { provider: "emailpass", entity_id: email.trim().toLowerCase() },
      { select: ["auth_identity_id"], take: 5 }
    )
    for (const login of logins) {
      const identity = login.auth_identity_id
        ? await auth.retrieveAuthIdentity(login.auth_identity_id).catch(() => null)
        : null
      if (identity && !identity.app_metadata?.["user_id"]) {
        await auth.deleteAuthIdentities([identity.id])
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}
