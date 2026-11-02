import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

/** Where the shop's own parcel's carrier is named (no carrier integration knows it). */
export const MANUAL_CARRIER_KEY = "qt_carrier_name"

/**
 * The carrier the staff named for a parcel the shop sends itself ("Kargoya
 * ver" by hand, F18): kept on the fulfillment's metadata beside what is
 * there, for the order page and the shipping e-mail. Undone, the metadata
 * goes back as it was.
 */
export const noteManualCarrierStep = createStep(
  "shipping-note-manual-carrier",
  async (input: { fulfillment_id: string; carrier: string }, { container }) => {
    const fulfillments = container.resolve(Modules.FULFILLMENT)
    const current = await fulfillments.retrieveFulfillment(input.fulfillment_id, {
      select: ["id", "metadata"],
    })
    const before = current.metadata ?? null
    await fulfillments.updateFulfillment(input.fulfillment_id, {
      metadata: { ...(before ?? {}), [MANUAL_CARRIER_KEY]: input.carrier },
    })
    return new StepResponse(null, { id: input.fulfillment_id, metadata: before })
  },
  async (previous, { container }) => {
    if (previous) {
      await container
        .resolve(Modules.FULFILLMENT)
        .updateFulfillment(previous.id, { metadata: previous.metadata ?? {} })
    }
  }
)
