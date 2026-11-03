import { z } from "@medusajs/framework/zod"

/** `?q=&offset=&limit=`: the shop's synonym groups, those holding `q` when given. */
export const AdminGetSearchSynonyms = z
  .object({
    q: z.string().trim().max(60).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export type AdminGetSearchSynonymsType = z.infer<typeof AdminGetSearchSynonyms>

// Shape and size only. What a term holds (a letter or digit, no control
// characters, at most three words) and the group's distinct terms are the
// workflow's (lib/search/synonyms.ts): its refusals reach the client as their
// keys, which Medusa's own wording of a schema rule would hide
const term = z.string().trim().max(60)

/** A synonym group: `{ terms: ["tişört", "t shirt"] }`. */
export const AdminPostSearchSynonym = z.object({ terms: z.array(term).min(2).max(10) }).strict()
export type AdminPostSearchSynonymType = z.infer<typeof AdminPostSearchSynonym>
