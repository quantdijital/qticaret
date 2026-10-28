import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { rejectRequest } from "./reject"

interface ProviderIdentity {
  provider: string
  entity_id: string
  user_metadata?: Record<string, unknown> | null
}

/**
 * The address an identity logs in with: its e-mail login's, else the one a
 * social provider vouched for (Google refuses an unverified one).
 */
export function loginEmailOf(identities: readonly ProviderIdentity[]): string | null {
  const own = identities.find((each) => each.provider === "emailpass")?.entity_id
  const vouched = identities
    .map((each) => each.user_metadata?.["email"])
    .find((value): value is string => typeof value === "string")
  const email = (own ?? vouched ?? "").trim().toLowerCase()
  return email === "" ? null : email
}

/**
 * `POST /store/customers` takes the e-mail from the registering identity,
 * whatever the body says: Medusa takes any address there (2.21.2), so a
 * registration token could open an account in a stranger's name
 * (adr/0037 §1). Runs after Medusa's authentication and body validation.
 */
export async function registrationEmailFromIdentity(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const authIdentityId = (req as Partial<AuthenticatedMedusaRequest>).auth_context
      ?.auth_identity_id
    const body = req.validatedBody as Record<string, unknown> | undefined
    if (!authIdentityId || !body) {
      // Medusa's own route refuses a request without a registration token
      next()
      return
    }
    const identity = await req.scope
      .resolve(Modules.AUTH)
      .retrieveAuthIdentity(authIdentityId, { relations: ["provider_identities"] })
    const email = loginEmailOf(identity.provider_identities ?? [])
    if (!email) {
      rejectRequest(
        req,
        res,
        400,
        { type: "invalid_data", message: "account.login_email_missing" },
        "login_email_missing"
      )
      return
    }
    body["email"] = email
    next()
  } catch (error) {
    next(error)
  }
}

/** F10.1 (adr/0037): a customer account is opened for the identity's own address. */
export const ACCOUNT_ROUTES = [
  {
    matcher: "/store/customers",
    methods: ["POST" as const],
    middlewares: [registrationEmailFromIdentity],
  },
]
