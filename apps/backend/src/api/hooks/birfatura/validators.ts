import { z } from "@medusajs/framework/zod"

/**
 * BirFatura's request bodies (adr/0072 §3.8), field names as its document
 * writes them. An outside caller: a field it does not document is dropped,
 * never read and never a 400, so an addition on its side does not stop the
 * shop's invoicing; the documented fields keep their checks. Its optional
 * fields may come as null ("Opsiyonel alanlar kullanılmıyorsa null olabilir").
 *
 * Medusa's `zodValidator` (v2.21.2 `framework/dist/zod/zod-helpers.js`)
 * makes any schema with a `strict` method strict before it parses, so a
 * plain object would still answer 400. The documented keys are picked
 * first (`z.preprocess`, a pipe with no `strict`), then checked strictly.
 */
function documentedOnly<T extends z.ZodRawShape>(shape: T) {
  const keys = new Set(Object.keys(shape))
  return z.preprocess(
    (body) =>
      body !== null && typeof body === "object" && !Array.isArray(body)
        ? Object.fromEntries(Object.entries(body).filter(([key]) => keys.has(key)))
        : body,
    z.object(shape).strict()
  )
}

const orderId = z.coerce
  .number()
  .int()
  .positive()
  .refine((value) => Number.isSafeInteger(value))
// `dd.MM.yyyy HH:mm:ss`; the date itself is checked where it is used
const date = z.string().trim().max(19)
const optionalText = (max: number) => z.string().trim().max(max).nullish()

/** `POST /api/orders`: the state asked for and the range, all required. */
export const BirfaturaOrdersBody = documentedOnly({
  orderStatusId: z.coerce.number().int().min(0).max(999),
  startDateTime: date,
  endDateTime: date,
})
export type BirfaturaOrdersBodyType = z.infer<typeof BirfaturaOrdersBody>

/** `POST /api/orderCargoUpdate`: taken and set aside (adr/0072 §6). */
export const BirfaturaCargoBody = documentedOnly({
  orderId,
  orderStatusId: z.coerce.number().int().min(0).max(999),
  cargoTrackingCode: z.string().trim().min(1).max(100),
  updateDateTime: date.nullish(),
  cargoTrackingCodeUrl: optionalText(2048),
  cargoCompany: optionalText(200),
})
export type BirfaturaCargoBodyType = z.infer<typeof BirfaturaCargoBody>

/** `POST /api/invoiceLinkUpdate`: the PDF's address, and the number and date when it has them. */
export const BirfaturaInvoiceLinkBody = documentedOnly({
  orderId,
  faturaUrl: z.string().trim().min(1).max(2048),
  faturaNo: optionalText(40),
  faturaTarihi: date.nullish(),
})
export type BirfaturaInvoiceLinkBodyType = z.infer<typeof BirfaturaInvoiceLinkBody>
