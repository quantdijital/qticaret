import { z } from "@medusajs/framework/zod"

/**
 * BirFatura's request bodies (adr/0072 §3.8), field names as its document
 * writes them. An outside caller: a field it does not document is dropped,
 * never read and never a 400, so an addition on its side does not stop the
 * shop's invoicing; the documented fields keep their checks. Its optional
 * fields may come as null ("Opsiyonel alanlar kullanılmıyorsa null olabilir").
 * Zod objects strip unknown keys unless made strict.
 */

const orderId = z.coerce
  .number()
  .int()
  .positive()
  .refine((value) => Number.isSafeInteger(value))
// `dd.MM.yyyy HH:mm:ss`; the date itself is checked where it is used
const date = z.string().trim().max(19)
const optionalText = (max: number) => z.string().trim().max(max).nullish()

/** `POST /api/orders`: the state asked for and the range, all required. */
export const BirfaturaOrdersBody = z.object({
  orderStatusId: z.coerce.number().int().min(0).max(999),
  startDateTime: date,
  endDateTime: date,
})
export type BirfaturaOrdersBodyType = z.infer<typeof BirfaturaOrdersBody>

/** `POST /api/orderCargoUpdate`: taken and set aside (adr/0072 §6). */
export const BirfaturaCargoBody = z.object({
  orderId,
  orderStatusId: z.coerce.number().int().min(0).max(999),
  cargoTrackingCode: z.string().trim().min(1).max(100),
  updateDateTime: date.nullish(),
  cargoTrackingCodeUrl: optionalText(2048),
  cargoCompany: optionalText(200),
})
export type BirfaturaCargoBodyType = z.infer<typeof BirfaturaCargoBody>

/** `POST /api/invoiceLinkUpdate`: the PDF's address, and the number and date when it has them. */
export const BirfaturaInvoiceLinkBody = z.object({
  orderId,
  faturaUrl: z.string().trim().min(1).max(2048),
  faturaNo: optionalText(40),
  faturaTarihi: date.nullish(),
})
export type BirfaturaInvoiceLinkBodyType = z.infer<typeof BirfaturaInvoiceLinkBody>
