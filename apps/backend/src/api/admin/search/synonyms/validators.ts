import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../../lib/security/text"

/** `?q=&offset=&limit=`: the shop's synonym groups, those holding `q` when given. */
export const AdminGetSearchSynonyms = z
  .object({
    q: z.string().trim().max(60).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export type AdminGetSearchSynonymsType = z.infer<typeof AdminGetSearchSynonyms>

// Shape and size only; words per term and the group's distinct terms are checked in the workflow
const term = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine((text) => isCleanText(text), { message: "search.synonym_term_invalid" })

/** A synonym group: `{ terms: ["tişört", "t shirt"] }`. */
export const AdminPostSearchSynonym = z.object({ terms: z.array(term).min(2).max(10) }).strict()
export type AdminPostSearchSynonymType = z.infer<typeof AdminPostSearchSynonym>
