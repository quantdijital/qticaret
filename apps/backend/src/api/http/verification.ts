import { createHash } from "node:crypto"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { FilterableAuthVerificationProps } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { rejectRequest } from "./reject"

// As Medusa keeps a verification code: its SHA-256, in hex (2.21.2)
const codeHash = (code: string) => createHash("sha256").update(code).digest("hex")

/**
 * `POST /auth/verification/confirm` confirms an address for the identity
 * that asked for the code, in that identity's own session (F15.1; F14
 * closing review). Medusa takes the code alone (2.21.2): someone who
 * registered with a stranger's address could have the stranger open the
 * mailed link and confirm the address for them. Here the request carries
 * the asking identity's token (the one its sign-in or registration gave),
 * and a code of another identity answers as an unknown one would.
 * Runs after Medusa's authentication and body validation.
 */
export async function verificationOfOwnIdentity(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const identity = (req as Partial<AuthenticatedMedusaRequest>).auth_context?.auth_identity_id
    if (!identity) {
      rejectRequest(
        req,
        res,
        401,
        { type: "unauthorized", message: "account.verification_session_required" },
        "verification_session_required"
      )
      return
    }
    const code = (req.validatedBody as { code?: unknown } | undefined)?.code
    if (typeof code === "string" && code !== "") {
      const [verification] = await req.scope.resolve(Modules.AUTH).listAuthVerifications(
        // The JSON filter Medusa's own confirmation reads with; its types leave the field out
        { provider_metadata: { token_hash: codeHash(code) } } as FilterableAuthVerificationProps,
        { take: 1, select: ["id", "auth_identity_id"] }
      )
      if (verification && verification.auth_identity_id !== identity) {
        rejectRequest(
          req,
          res,
          400,
          { type: "not_allowed", message: "Verification code is invalid or already used" },
          "verification_foreign_identity"
        )
        return
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}
