import { z } from "@medusajs/framework/zod"

/** "Ödemeye geç" takes nothing: the cart is the link's, never the request's. */
export const StorePostPaymentLinkCart = z.object({}).strict()

export type StorePostPaymentLinkCartType = z.infer<typeof StorePostPaymentLinkCart>
