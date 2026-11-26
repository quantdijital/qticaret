import { carrierLabelPdf } from "../label"
import type { LabelSize } from "../label-sheet"
import type { Receiver } from "../receiver"

/**
 * The parcel's label for Yurtiçi (adr/0035): Yurtiçi gives none, its
 * branch scans the cargo key on the box. The shared carrier label
 * (`../label`) with the key as its barcode; no sender: Yurtiçi knows it
 * from the contract.
 */

export interface YurticiLabelInput {
  cargoKey: string
  orderNumber: string
  receiver: Receiver
  /** Null when not sent to Yurtiçi (a product without measures, adr/0054). */
  desi: number | null
  kg: number | null
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
  test: boolean
}

export const yurticiLabelPdf = (input: YurticiLabelInput, size?: LabelSize): Promise<Uint8Array> =>
  carrierLabelPdf(
    {
      carrier: "Yurtiçi Kargo",
      code: input.cargoKey,
      orderNumber: input.orderNumber,
      receiver: input.receiver,
      desi: input.desi,
      kg: input.kg,
      cashOnDelivery: input.cashOnDelivery,
      test: input.test,
    },
    size
  )
