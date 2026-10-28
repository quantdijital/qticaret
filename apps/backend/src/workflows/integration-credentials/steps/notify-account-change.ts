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
}

/**
 * Tells every admin, in the panel's bell, that a provider account
 * (payment, shipping) changed, by whom (adr/0027 §6): until roles arrive (F12) any staff
 * member can change it, so nobody should do it unseen. The last step of
 * its workflows; when the alert cannot be written, the change is undone.
 */
export const notifyAccountChangeStep = createStep(
  "integration-credentials-notify",
  async (input: NotifyAccountChangeInput, { container }) => {
    if (input.changes.length === 0) {
      return new StepResponse(false)
    }
    let who: string | null = null
    if (input.actor_id) {
      const user = await container
        .resolve(Modules.USER)
        .retrieveUser(input.actor_id)
        .catch(() => null)
      who = user?.email ?? null
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
