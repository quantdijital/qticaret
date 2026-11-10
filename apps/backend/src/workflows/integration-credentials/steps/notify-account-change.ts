import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { notificationText } from "../../../lib/notifications/messages"
import type { CredentialProviderName } from "../../../modules/integration-credentials/providers"
import type { AccountChange } from "../../../modules/integration-credentials/rules"

export interface NotifyAccountChangeInput {
  provider: CredentialProviderName
  changes: AccountChange[]
  actor_id: string | null
}

const PROVIDER_NAMES: Readonly<Record<CredentialProviderName, string>> = {
  paytr: "PayTR",
  iyzico: "iyzico",
  geliver: "Geliver",
  aras: "Aras Kargo",
  yurtici: "Yurtiçi Kargo",
  netgsm: "Netgsm",
  google: "Google",
  meta: "Meta",
  ga4: "Google Analytics 4",
  shopify: "Shopify",
  smtp: "SMTP",
}

/**
 * Tells every admin, in the panel's bell, that a provider account
 * (payment, shipping) changed, by whom (adr/0027 §6): only the owner can
 * change one (adr/0040), and nobody should do it unseen. The owner is
 * named by name; the panel says "the owner" when there is none. The last step of
 * its workflows; when the alert cannot be written, the change is undone.
 */
export const notifyAccountChangeStep = createStep(
  "integration-credentials-notify",
  async (input: NotifyAccountChangeInput, { container }) => {
    if (input.changes.length === 0) {
      return new StepResponse(false)
    }
    // The name, never the e-mail: every role reads the bell, not every role the team list
    let who: string | null = null
    if (input.actor_id) {
      const user = await container
        .resolve(Modules.USER)
        .retrieveUser(input.actor_id)
        .catch(() => null)
      who = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || null
    }
    const provider = PROVIDER_NAMES[input.provider]
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "integration_credentials.changed",
      resource_id: input.provider,
      data: {
        kind: "provider_account",
        provider: input.provider,
        changes: input.changes,
        actor: who,
        actor_id: input.actor_id,
        // Medusa's own admin shows these as they are; the panel words the alert from the rest
        ...notificationText("integrations.account_changed", {
          provider,
          who: who ?? "—",
          what: input.changes.join(", "),
        }),
      },
    })
    return new StepResponse(true)
  }
)
