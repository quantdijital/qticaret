import { z } from "@medusajs/framework/zod"

/** A cart to judge cash on delivery for (its total, its courier); none: only what does not depend on it. */
export const StoreGetPaymentMethods = z
  .object({
    cart_id: z
      .string()
      .regex(/^cart_[0-9A-Za-z]{1,40}$/)
      .optional(),
  })
  .strict()

export type StoreGetPaymentMethodsType = z.infer<typeof StoreGetPaymentMethods>
