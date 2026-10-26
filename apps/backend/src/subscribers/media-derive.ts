import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { deriveProductMediaWorkflow } from "../workflows/media/workflows"

/**
 * A saved product's images get their versions (F3.3) after the save answers;
 * a failure never fails the save, and the nightly sweep tries again.
 */
export default async function mediaDerive({ event, container }: SubscriberArgs<{ id: string }>) {
  try {
    await deriveProductMediaWorkflow(container).run({ input: { product_id: event.data.id } })
  } catch (error) {
    logger.warn({
      event: "media.derive_failed",
      productId: event.data.id,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
