import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { pttCredentialsOf } from "../../../lib/shipping/ptt/credentials"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { PTT_BARCODE_MODULE } from "../../../modules/ptt-barcode"
import type PttBarcodeModuleService from "../../../modules/ptt-barcode/service"

/**
 * The barcode a PTT parcel goes under (docs/entegrasyonlar/ptt.md): the
 * next number of the shop's range, taken for good before the parcel is
 * opened. No undo: a number handed out is never handed out again, even
 * when the parcel then fails (PTT may keep a half record). Asked only with
 * the PTT account connected, so a missing account burns no number. A
 * missing or used-up range stops "Kargoya ver" with its own message.
 */
export const reservePttBarcodeStep = createStep(
  "shipping-reserve-ptt-barcode",
  async (input: { order_id: string }, { container }) => {
    const account = await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("ptt")
    if (!pttCredentialsOf(account)) {
      throw new ValidationError("shipping.carrier_not_connected")
    }
    const taken = await container.resolve<PttBarcodeModuleService>(PTT_BARCODE_MODULE).allocate()
    if (taken.status === "missing") {
      throw new ValidationError("ptt.barcode_range_missing")
    }
    if (taken.status === "exhausted") {
      throw new ValidationError("ptt.barcode_range_exhausted")
    }
    logger.info({
      event: "ptt.barcode_reserved",
      orderId: input.order_id,
      remaining: taken.remaining,
    })
    return new StepResponse({ barcode: taken.barcode })
  }
)
