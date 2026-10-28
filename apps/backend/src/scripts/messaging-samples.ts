import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { emailTransport } from "../lib/messaging/email"
import { MESSAGE_TEMPLATES } from "../lib/messaging/templates"
import type { MessageTemplate } from "../lib/messaging/templates"
import { brandOf } from "../workflows/messaging/brand"
import { senderAddress } from "../workflows/messaging/sender-domain"

/**
 * Sends every e-mail template with its sample values, in the shop's own
 * brand, to Mailpit to look at (F9 KK1, adr/0036): http://localhost:58025.
 * Refused unless e-mail goes to Mailpit, so no sample reaches a real inbox.
 *
 * Usage: pnpm --filter @qticaret/backend messaging:samples
 */
export default async function run({ container }: ExecArgs): Promise<void> {
  const transport = emailTransport()
  if (transport?.name !== "mailpit") {
    throw new Error("messaging samples: EMAIL_TRANSPORT must be mailpit")
  }
  const from = await senderAddress(container)
  if (!from) {
    throw new Error("messaging samples: EMAIL_FROM is not set")
  }
  const brand = await brandOf(container)
  const batch = String(Date.now())
  let sent = 0
  for (const template of Object.values(MESSAGE_TEMPLATES) as MessageTemplate<unknown>[]) {
    const mail = template.email?.(template.sample, brand, {
      unsubscribeUrl:
        template.kind === "commercial" ? "https://magaza.example/unsubscribe?t=ornek" : null,
    })
    if (!mail) {
      continue
    }
    await transport.send({
      from: { email: from, name: brand.shopName },
      to: "ornek@magaza.test",
      replyTo: brand.contactEmail,
      ...mail,
      template: template.name,
      idempotencyKey: `sample:${template.name}:${batch}`,
    })
    sent += 1
  }
  logger.info({ event: "messaging.samples_sent", sent }, "messaging samples sent to Mailpit")
}
