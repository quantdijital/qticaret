import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { parseEnv } from "../../../../lib/env"
import { PAYMENT_SESSION_ID, storeOrigins } from "../../../../lib/payments/checkout"
import { errorSummary, logger } from "../../../../lib/logging"
import { iyzicoCredentialsOf, isCallbackGenuine } from "../../../../lib/payments/iyzico"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../modules/integration-credentials/service"
import { iyzicoCallbackWorkflow } from "../../../../workflows/payments/iyzico-callback"
import type { IyzicoCallbackResult } from "../../../../workflows/payments/iyzico-callback"

// iyzico posts the form's token from the shopper's browser; our session is in the address
const callback = z.object({
  session: z.string().regex(PAYMENT_SESSION_ID),
  sig: z.string().regex(/^[0-9a-f]{32}$/),
  token: z.string().regex(/^[A-Za-z0-9-]{1,200}$/),
})

const storefront = () => storeOrigins(parseEnv())[0] ?? ""

/** Where the shopper goes: the session's return address, with what the storefront should say. */
function destination(result: IyzicoCallbackResult): string | null {
  const urls = result.return_urls
  if (result.outcome === "paid") {
    return urls?.success ?? null
  }
  const status = { review: "review", orphan: "refund" }[result.outcome as string]
  const base = status ? urls?.success : urls?.failure
  if (!base) {
    return null
  }
  const url = new URL(base)
  if (status) {
    url.searchParams.set("payment_status", status)
  }
  return url.href
}

/**
 * iyzico's callback (adr/0026 §5): the shopper's browser, sent back by the
 * checkout form with its token. The result comes from iyzico itself
 * (`iyzicoCallbackWorkflow`); the shopper goes on to the storefront's
 * return address the session stored (checked when the payment started).
 * Without one (the session is gone), or when the result cannot be read now
 * (the reconcile job places it later), to the storefront's first origin.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const fields = callback.safeParse({
    session: req.query["session"],
    sig: req.query["sig"],
    token: (req.body as Record<string, unknown> | undefined)?.["token"],
  })
  if (!fields.success) {
    res.status(400).type("text/plain").send("invalid callback")
    return
  }
  // An address we did not give out costs nothing more: no lookup, no call to iyzico
  const account = iyzicoCredentialsOf(
    await req.scope
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("iyzico")
  )
  if (!account || !isCallbackGenuine(account.secretKey, fields.data.session, fields.data.sig)) {
    res.status(400).type("text/plain").send("invalid callback")
    return
  }
  try {
    const { result } = await iyzicoCallbackWorkflow(req.scope).run({
      input: { session_id: fields.data.session, token: fields.data.token },
    })
    if (result.outcome === "not_ours") {
      logger.warn({ event: "iyzico.callback_not_ours", sessionId: fields.data.session })
      res.status(400).type("text/plain").send("unknown payment")
      return
    }
    res.redirect(303, destination(result) ?? `${storefront()}/`)
  } catch (error) {
    // The payment, if taken, is placed later by the reconcile job: the storefront says so
    logger.error({
      event: "iyzico.callback_failed",
      sessionId: fields.data.session,
      err: errorSummary(error),
    })
    res.redirect(303, `${storefront()}/?payment_status=pending`)
  }
}
