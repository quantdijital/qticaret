import type { MedusaContainer } from "@medusajs/framework/types"
import { emailLinkUrl } from "../../../lib/messaging/links"
import type { ConsentConfirmVars } from "../../../lib/messaging/templates"
import { MESSAGING_MODULE } from "../../../modules/messaging"
import type MessagingModuleService from "../../../modules/messaging/service"
import { brandOf } from "../brand"
import type { Loaded } from "./types"

/**
 * A consent request's confirmation (security review 2026-10-29): to the
 * address it names alone, on its channel, with the link whose token only
 * the request knew. The address is decrypted here, to send.
 */
export async function loadConsentRequest(
  container: Pick<MedusaContainer, "resolve">,
  requestId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<ConsentConfirmVars> | null> {
  const request = await container
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .consentRequestOf(requestId)
  if (!request) {
    return null
  }
  const token = extra["token"]
  const { storefrontUrl } = await brandOf(container)
  return {
    vars: {
      granting: request.status === "granted",
      // The storefront's page once the shop has a host (adr/0038 Ek 2026-11-02)
      confirmUrl: token ? emailLinkUrl("consent", token, storefrontUrl) : null,
    },
    recipients: { [request.channel]: request.address },
    receiverId: null,
    resourceType: "consent_request",
  }
}
