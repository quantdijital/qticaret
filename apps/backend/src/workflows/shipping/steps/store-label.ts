import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

/**
 * Drops the carrier's label from the fulfillment when the shipping fails
 * after the parcel was packed: Medusa cancels the fulfillment but keeps
 * its data, and the label holds a person's name, address and phone. Does
 * nothing on its way.
 */
export const forgetLabelSourceStep = createStep(
  "shipping-forget-label-source",
  (input: { fulfillment_id: string }) => new StepResponse(null, input.fulfillment_id),
  async (fulfillmentId, { container }) => {
    if (fulfillmentId) {
      await container.resolve(Modules.FULFILLMENT).updateFulfillment(fulfillmentId, {
        data: { label_base64: null, label_type: null, label_zpl: null },
      })
    }
  }
)

// What a carrier hands over as its label: a PDF, its own or one we drew (Yurtiçi's barcode)
const LABEL_TYPES: Readonly<Record<string, string>> = {
  "application/pdf": "pdf",
}

/** The parcel's label as its carrier left it on the fulfillment (adr/0035): the PDF we print. */
function labelOf(
  data: Record<string, unknown>
): { bytes: Buffer; type: string; extension: string } | null {
  const base64 = data["label_base64"]
  const type = typeof data["label_type"] === "string" ? data["label_type"] : ""
  const extension = LABEL_TYPES[type]
  if (typeof base64 !== "string" || !extension) {
    return null
  }
  return { bytes: Buffer.from(base64, "base64"), type, extension }
}

/** Writes one file to the shop's private storage under a name nobody can guess. */
async function storePrivately(
  container: Pick<MedusaContainer, "resolve">,
  bytes: Buffer,
  mimeType: string,
  extension: string
): Promise<string> {
  const upload = await container.resolve(Modules.FILE).getUploadStream({
    // Not guessable: a local or development store guards files by their name only
    filename: `etiket-${randomUUID()}.${extension}`,
    mimeType,
    access: "private",
  })
  upload.writeStream.end(bytes)
  await upload.promise
  return upload.fileKey
}

// A carrier's Zebra label beside ours (DHL eCommerce), kept for a thermal printer later
const zplOf = (data: Record<string, unknown>): Buffer | null =>
  typeof data["label_zpl"] === "string" && data["label_zpl"] !== ""
    ? Buffer.from(data["label_zpl"], "utf8")
    : null

/**
 * Keeps the shipment's label in the shop's private storage (adr/0031): it
 * holds the recipient's name, address and phone. The fulfillment keeps the
 * stored file's key; the carrier's copy is dropped. Undone by removing the
 * file and putting the data back.
 */
export const storeShipmentLabelStep = createStep(
  "shipping-store-label",
  async (input: { fulfillment_id: string }, { container }) => {
    const fulfillments = container.resolve(Modules.FULFILLMENT)
    const fulfillment = await fulfillments.retrieveFulfillment(input.fulfillment_id)
    const data: Record<string, unknown> = fulfillment.data ?? {}
    const label = labelOf(data)
    if (!label) {
      return new StepResponse(null, null)
    }
    const fileKey = await storePrivately(container, label.bytes, label.type, label.extension)
    const zpl = zplOf(data)
    const zplKey = zpl ? await storePrivately(container, zpl, "text/plain", "zpl") : null
    // The carrier's label leaves the fulfillment (Medusa merges `data`: set to null)
    await fulfillments.updateFulfillment(input.fulfillment_id, {
      data: {
        ...data,
        label_base64: null,
        label_type: null,
        label_zpl: null,
        label_file_id: fileKey,
        ...(zplKey ? { label_zpl_file_id: zplKey } : {}),
      },
    })
    return new StepResponse(
      { label_file_id: fileKey },
      {
        fulfillment_id: input.fulfillment_id,
        data,
        files: zplKey ? [fileKey, zplKey] : [fileKey],
      }
    )
  },
  async (stored, { container }) => {
    if (!stored) {
      return
    }
    await container.resolve(Modules.FILE).deleteFiles(stored.files)
    await container.resolve(Modules.FULFILLMENT).updateFulfillment(stored.fulfillment_id, {
      data: {
        ...stored.data,
        label_base64: null,
        label_type: null,
        label_zpl: null,
        label_file_id: null,
        label_zpl_file_id: null,
      },
    })
  }
)
