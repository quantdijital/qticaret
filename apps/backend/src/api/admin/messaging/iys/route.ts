import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { iysAccountOf } from "../../../../lib/messaging/sms/netgsm-iys"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../modules/integration-credentials/service"
import { MESSAGING_MODULE } from "../../../../modules/messaging"
import type MessagingModuleService from "../../../../modules/messaging/service"

/**
 * GET /admin/messaging/iys (F10 M11): how the consents are reaching İYS,
 * for Settings > SMS. Counts only; no address leaves.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const messaging = req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const count = async (status: "pending" | "sent" | "failed") =>
    (
      await messaging.listAndCountMessageConsents(
        { iys_status: status },
        { take: 1, select: ["id"] }
      )
    )[1]
  const [pending, sent, failed, account] = await Promise.all([
    count("pending"),
    count("sent"),
    count("failed"),
    req.scope
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("netgsm"),
  ])
  res.json({ iys: { brand_code_set: iysAccountOf(account) !== null, pending, sent, failed } })
}
