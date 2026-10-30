import { z } from "@medusajs/framework/zod"

/**
 * The buyer's declaration of age (F13.3, adr/0041 §4): their date of birth,
 * checked against the shop's limit and never kept, and the box they ticked.
 */
export const StorePostAgeDeclaration = z
  .object({
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "age.birth_date_invalid" }),
    confirmed: z.literal(true),
  })
  .strict()
export type StorePostAgeDeclarationType = z.infer<typeof StorePostAgeDeclaration>
