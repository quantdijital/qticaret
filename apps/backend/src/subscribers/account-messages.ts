import { createHash } from "node:crypto"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
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

// The secret itself never names a notification row: a short digest of it does
const digest = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex").slice(0, 24)

/**
 * A customer's account messages (F9.4): the password reset link and the
 * e-mail verification code (Medusa's own events). The secret goes to the
 * loader only, never into a stored row. Staff resets wait for the panel's
 * own page (F12).
 */
export default async function accountMessages({
  event: { name, data },
  container,
}: SubscriberArgs<AuthEvent>) {
  if (name === "auth.password_reset") {
    if (data.actor_type !== "customer" || !data.token) {
      return
    }
    await sendMessageWorkflow(container).run({
      input: {
        template: "account.password_reset",
        resource_id: digest(data.token),
        extra: { email: data.entity_id, token: data.token },
      },
    })
    return
  }
  if (data.entity_type !== "email" || !data.code) {
    return
  }
  await sendMessageWorkflow(container).run({
    input: {
      template: "account.verify_email",
      resource_id: data.auth_identity_id ?? digest(data.entity_id),
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
