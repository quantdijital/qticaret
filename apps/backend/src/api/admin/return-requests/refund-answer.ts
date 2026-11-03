import type { MedusaContainer } from "@medusajs/framework/types"
import { I18N_KEY } from "../../../lib/errors/http"
import { serverErrorMessage } from "../../../lib/errors/messages"
import { errorSummary, logger } from "../../../lib/logging"
import { refundReturn } from "../../../workflows/returns/receive-return"
import { returnRequestDetail } from "./view"

type Detailed = Parameters<typeof returnRequestDetail>[1]

/**
 * Gives a received request's money back and answers with the request; a
 * refund that fails leaves it received, with the reason staff read
 * ("refund" tries it again). `received`: the request as it stands before.
 */
export async function refundAnswer<T extends Detailed>(
  container: MedusaContainer,
  input: { id: string; staff_id: string },
  received: T
) {
  try {
    const refunded = await refundReturn(container, input)
    return { return_request: await returnRequestDetail(container, refunded), refund_error: null }
  } catch (error) {
    logger.warn({
      event: "returns.refund_failed",
      returnRequestId: input.id,
      err: errorSummary(error),
    })
    const key = (error as { safeMessage?: unknown }).safeMessage
    return {
      return_request: await returnRequestDetail(container, received),
      refund_error:
        typeof key === "string" && I18N_KEY.test(key)
          ? serverErrorMessage(key, "tr")
          : serverErrorMessage("returns.refund_failed", "tr"),
    }
  }
}
