import { z } from "@medusajs/framework/zod"

const id = z.string().min(1).max(100)

/** A cart (`?cart_id=`), or a variant in a region (`?variant_id=&region_id=`). */
export const StoreGetInstallments = z
  .object({ cart_id: id.optional(), variant_id: id.optional(), region_id: id.optional() })
  .strict()
  .refine(
    (query) =>
      query.cart_id !== undefined
        ? query.variant_id === undefined && query.region_id === undefined
        : query.variant_id !== undefined && query.region_id !== undefined,
    { message: "payments.installments_target", path: ["cart_id"] }
  )
export type StoreGetInstallmentsType = z.infer<typeof StoreGetInstallments>
