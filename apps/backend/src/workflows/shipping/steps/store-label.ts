import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { downloadLabel } from "../../../lib/shipping/geliver/labels"

/**
 * Keeps the shipment's label PDF in the shop's private storage (adr/0031):
 * it holds the recipient's name, address and phone. The fulfillment keeps
 * the stored file's key; Geliver's address for it is dropped. Undone by
 * removing the file and putting the address back.
 */
export const storeShipmentLabelStep = createStep(
  "shipping-store-label",
  async (input: { fulfillment_id: string }, { container }) => {
    const fulfillments = container.resolve(Modules.FULFILLMENT)
    const fulfillment = await fulfillments.retrieveFulfillment(input.fulfillment_id)
    const data: Record<string, unknown> = fulfillment.data ?? {}
    const source = data["label_source"]
    if (typeof source !== "string") {
      return new StepResponse(null, null)
    }
    const pdf = await downloadLabel(source)
    const upload = await container.resolve(Modules.FILE).getUploadStream({
      filename: `etiket-${input.fulfillment_id}.pdf`,
      mimeType: "application/pdf",
      access: "private",
    })
    upload.writeStream.end(pdf)
    await upload.promise
    // Geliver's address for the label is dropped (Medusa merges `data`: set to null)
    await fulfillments.updateFulfillment(input.fulfillment_id, {
      data: { ...data, label_source: null, label_file_id: upload.fileKey },
    })
    return new StepResponse(
      { label_file_id: upload.fileKey },
      { fulfillment_id: input.fulfillment_id, data, file: upload.fileKey }
    )
  },
  async (stored, { container }) => {
    if (!stored) {
      return
    }
    await container.resolve(Modules.FILE).deleteFiles(stored.file)
    await container
      .resolve(Modules.FULFILLMENT)
      .updateFulfillment(stored.fulfillment_id, { data: { ...stored.data, label_file_id: null } })
  }
)
