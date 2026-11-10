import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { hashPii, parseKey } from "@qticaret/server-kit"
import { parseEnv } from "../lib/env"
import { logger } from "../lib/logging"
import { sendMessageWorkflow } from "../workflows/messaging/send-message"

interface AuthEvent {
  entity_id: string
  actor_type?: string
  token?: string
  entity_type?: string
  auth_identity_id?: string
  code?: string
  expires_at?: string | Date
}

// The secret itself never names a notification row: a keyed digest of it
// does, so a six-digit code cannot be found again by trying every one
const digest = (secret: string): string =>
  hashPii(secret, parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"), "messaging.secret").slice(
    0,
    32
  )

/**
 * Whether the address is the login of the identity asking: Medusa's
 * `/auth/verification/request` takes any address (2.21.2), and a code goes
 * nowhere else, or anyone could have the shop mail strangers (adr/0037 §1).
 */
async function ownsAddress(
  container: MedusaContainer,
  authIdentityId: string,
  address: string
): Promise<boolean> {
  const identity = await container
    .resolve(Modules.AUTH)
    .retrieveAuthIdentity(authIdentityId, { relations: ["provider_identities"] })
    .catch(() => null)
  const wanted = address.trim().toLowerCase()
  return (identity?.provider_identities ?? []).some(
    (each) => each.provider === "emailpass" && each.entity_id.trim().toLowerCase() === wanted
  )
}

/**
 * Account messages (F9.4): a customer's or a staff member's password reset link, and the
 * e-mail verification code (Medusa's own events). The secret goes to the
 * loader only, never into a stored row. A staff member's reset goes to the
 * panel's own page (F12.6).
 */
export default async function accountMessages({
  event: { name, data },
  container,
}: SubscriberArgs<AuthEvent>) {
  if (name === "auth.password_reset") {
    const template =
      data.actor_type === "customer"
        ? "account.password_reset"
        : data.actor_type === "user"
          ? "staff.password_reset"
          : null
    if (!template || !data.token) {
      return
    }
    await sendMessageWorkflow(container).run({
      input: {
        template,
        resource_id: digest(data.token),
        extra: { email: data.entity_id, token: data.token },
      },
    })
    return
  }
  if (data.entity_type !== "email" || !data.code || !data.auth_identity_id) {
    return
  }
  if (!(await ownsAddress(container, data.auth_identity_id, data.entity_id))) {
    logger.warn({
      event: "messaging.verification_foreign_address",
      auth_identity_id: data.auth_identity_id,
    })
    return
  }
  await sendMessageWorkflow(container).run({
    input: {
      template: "account.verify_email",
      resource_id: data.auth_identity_id,
      key: digest(data.code),
      extra: {
        email: data.entity_id,
        code: data.code,
        expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : "",
      },
    },
  })
}

export const config: SubscriberConfig = {
  event: ["auth.password_reset", "auth.verification_requested"],
}
