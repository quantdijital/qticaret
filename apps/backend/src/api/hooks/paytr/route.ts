import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { logger } from "../../../lib/logging"
import {
  parsePaytrKurus,
  isNotificationGenuine,
  paytrCredentialsOf,
} from "../../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { paytrNotificationWorkflow } from "../../../workflows/payments/paytr-notification"

// What PayTR posts (dev.paytr.com, iFrame API step 2); only three fields are signed
const notification = z.object({
  merchant_oid: z.string().regex(/^[A-Za-z0-9]{1,64}$/),
  status: z.enum(["success", "failed"]),
  total_amount: z.string().regex(/^\d{1,12}$/),
  hash: z.string().min(1).max(200),
  test_mode: z.string().optional(),
  failed_reason_code: z.string().max(10).optional(),
})

const answer = (res: MedusaResponse, status: number, text: string) => {
  res.status(status).type("text/plain").send(text)
}

/**
 * PayTR's notification URL (adr/0026 §5). Plain "OK" only once the
 * notification is handled: anything else and PayTR sends it again. A
 * signature that does not match, or a reference that is not ours (a
 * shared account's other shop), never gets "OK".
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const fields = notification.safeParse(req.body)
  if (!fields.success) {
    answer(res, 400, "invalid notification")
    return
  }
  const account = paytrCredentialsOf(
    await req.scope
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("paytr")
  )
  if (!account) {
    answer(res, 503, "paytr account not configured")
    return
  }
  const { hash, ...signed } = fields.data
  if (!isNotificationGenuine(account, signed, hash)) {
    logger.warn({ event: "paytr.notification_forged", merchantOid: signed.merchant_oid })
    answer(res, 400, "invalid hash")
    return
  }
  const { result } = await paytrNotificationWorkflow(req.scope).run({
    input: {
      merchant_oid: signed.merchant_oid,
      status: signed.status,
      total_amount: parsePaytrKurus(signed.total_amount),
      test_mode: signed.test_mode === "1",
      failed_reason_code: signed.failed_reason_code ?? null,
    },
  })
  if (result === "ok") {
    answer(res, 200, "OK")
  } else if (result === "busy") {
    answer(res, 409, "in progress")
  } else {
    logger.warn({ event: "paytr.notification_not_ours", merchantOid: signed.merchant_oid })
    answer(res, 404, "unknown order")
  }
}
