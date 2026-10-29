import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type { ConsentRequestInput } from "../../modules/messaging/consent-requests"
import type MessagingModuleService from "../../modules/messaging/service"
import { deliver } from "./deliver"
import { loadConsentRequest } from "./loaders/consent"

/**
 * Double opt-in (security review 2026-10-29): keeps a consent for an
 * address no one has shown is theirs as a request, and sends its owner
 * the link that confirms it. Nothing is recorded, nor told to İYS, until
 * then. The token goes in the message only: no workflow keeps it.
 */
export async function askToConfirmConsent(
  container: Pick<MedusaContainer, "resolve">,
  input: ConsentRequestInput
): Promise<{ request_id: string }> {
  const { id, token } = await container
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .requestConsent(input)
  const loaded = await loadConsentRequest(container, id, { token })
  if (loaded) {
    await deliver(container, {
      template: "consent.confirm",
      resource: { type: loaded.resourceType, id },
      recipients: loaded.recipients,
      receiverId: loaded.receiverId,
      vars: loaded.vars,
      // A digest of the token, never part of it, sets this send apart
      key: createHash("sha256").update(token).digest("hex").slice(0, 16),
    })
  }
  return { request_id: id }
}
