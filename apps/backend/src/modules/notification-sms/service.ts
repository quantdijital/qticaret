import { container } from "@medusajs/framework"
import type { NotificationTypes } from "@medusajs/framework/types"
import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { netgsmAccountOf, netgsmApi } from "../../lib/messaging/sms/netgsm"
import { INTEGRATION_CREDENTIALS_MODULE } from "../integration-credentials"
import type IntegrationCredentialsModuleService from "../integration-credentials/service"

/**
 * SMS as a Medusa notification provider (`sms` channel, adr/0036), on the
 * shop's own Netgsm account, read from the shared container at the time
 * of the call (adr/0027). It sends what our send step rendered; a
 * commercial message goes with İYS filter 11, so Netgsm checks İYS too.
 * The message is never logged.
 */
class SmsNotificationService extends AbstractNotificationProviderService {
  static override identifier = "sms"

  static override validateOptions(options: Record<string, unknown>): void {
    const channels = options["channels"]
    if (!Array.isArray(channels) || !channels.includes("sms")) {
      throw new Error("notification-sms: configure it for the sms channel")
    }
  }

  override async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const account = netgsmAccountOf(
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .read("netgsm")
    )
    if (!account) {
      throw new ValidationError("messaging.sms_off")
    }
    const text = notification.content?.text
    if (!text) {
      throw new Error("notification-sms: send through the messaging step")
    }
    const { jobId } = await netgsmApi().send(account, {
      to: notification.to,
      text,
      commercial: notification.provider_data?.["commercial"] === true,
    })
    return { id: jobId }
  }
}

export default SmsNotificationService
