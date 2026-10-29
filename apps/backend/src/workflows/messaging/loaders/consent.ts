import type { MedusaContainer } from "@medusajs/framework/types"
import { parseEnv } from "../../../lib/env"
import type { ConsentConfirmVars } from "../../../lib/messaging/templates"
import { MESSAGING_MODULE } from "../../../modules/messaging"
import type MessagingModuleService from "../../../modules/messaging/service"
import type { Loaded } from "./types"

/** The backend's page that confirms a consent request (`/consents/confirm`). */
export const CONSENT_CONFIRM_PATH = "/consents/confirm"

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
  const backend = parseEnv().BACKEND_URL?.replace(/\/+$/, "")
  return {
    vars: {
      granting: request.status === "granted",
      confirmUrl:
        extra["token"] && backend
          ? `${backend}${CONSENT_CONFIRM_PATH}?${new URLSearchParams({ t: extra["token"] }).toString()}`
          : null,
    },
    recipients: { [request.channel]: request.address },
    receiverId: null,
    resourceType: "consent_request",
  }
}
