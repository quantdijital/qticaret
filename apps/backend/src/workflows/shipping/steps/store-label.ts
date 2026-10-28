import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { downloadLabel } from "../../../lib/shipping/geliver/labels"

/**
 * Keeps the shipment's label PDF in the shop's private storage (adr/0031):
 * it holds the recipient's name, address and phone. The fulfillment keeps
 * the stored file's key; Geliver's address for it is dropped. Undone by
 * removing the file and putting the address back.
 */
/**
 * Drops Geliver's address for the label when the shipping fails after the
 * parcel was packed: Medusa cancels the fulfillment but keeps its data,
 * and the address opens the label (a person's name, address and phone)
 * without a token. Does nothing on its way.
 */
export const forgetLabelSourceStep = createStep(
  "shipping-forget-label-source",
  (input: { fulfillment_id: string }) => new StepResponse(null, input.fulfillment_id),
  async (fulfillmentId, { container }) => {
    if (fulfillmentId) {
      await container.resolve(Modules.FULFILLMENT).updateFulfillment(fulfillmentId, {
        data: { label_source: null, label_base64: null, label_type: null },
      })
    }
  }
)

// What a carrier hands over as its label: a PDF, or a page we drew (a contract carrier's barcode)
const LABEL_TYPES: Readonly<Record<string, string>> = {
  "application/pdf": "pdf",
  "text/html": "html",
}

/**
 * The parcel's label as its carrier left it on the fulfillment: an address
 * to download it from (Geliver), or the label itself (adr/0035).
 */
async function labelOf(
  data: Record<string, unknown>
): Promise<{ bytes: Buffer; type: string; extension: string } | null> {
  const source = data["label_source"]
  if (typeof source === "string") {
    return { bytes: await downloadLabel(source), type: "application/pdf", extension: "pdf" }
  }
  const base64 = data["label_base64"]
  const type = typeof data["label_type"] === "string" ? data["label_type"] : ""
  const extension = LABEL_TYPES[type]
  if (typeof base64 !== "string" || !extension) {
    return null
  }
  return { bytes: Buffer.from(base64, "base64"), type, extension }
}

export const storeShipmentLabelStep = createStep(
  "shipping-store-label",
  async (input: { fulfillment_id: string }, { container }) => {
    const fulfillments = container.resolve(Modules.FULFILLMENT)
    const fulfillment = await fulfillments.retrieveFulfillment(input.fulfillment_id)
    const data: Record<string, unknown> = fulfillment.data ?? {}
    const label = await labelOf(data)
    if (!label) {
      return new StepResponse(null, null)
    }
    const upload = await container.resolve(Modules.FILE).getUploadStream({
      // Not guessable: a local or development store guards files by their name only
      filename: `etiket-${randomUUID()}.${label.extension}`,
      mimeType: label.type,
      access: "private",
    })
    upload.writeStream.end(label.bytes)
    await upload.promise
    // The carrier's label leaves the fulfillment (Medusa merges `data`: set to null)
    await fulfillments.updateFulfillment(input.fulfillment_id, {
      data: {
        ...data,
        label_source: null,
        label_base64: null,
        label_type: null,
        label_file_id: upload.fileKey,
      },
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
    await container.resolve(Modules.FULFILLMENT).updateFulfillment(stored.fulfillment_id, {
      data: {
        ...stored.data,
        label_source: null,
        label_base64: null,
        label_type: null,
        label_file_id: null,
      },
    })
  }
)
