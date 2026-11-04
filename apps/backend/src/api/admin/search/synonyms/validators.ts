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
// keys, which Medusa's own wording of a schema rule would hide. The size
// rules answer with their keys too: they are refinements, because Medusa
// words a `min`/`max` itself whatever message the rule carries
const MAX_TERM_LENGTH = 60
const MIN_TERMS = 2
const MAX_TERMS = 10
// Far past any group: the bound on what is read at all, worded by Medusa
const MAX_SENT = 100

const term = z
  .string()
  .trim()
  .refine((text) => text.length <= MAX_TERM_LENGTH, { message: "search.synonym_term_length" })

/** A synonym group: `{ terms: ["tişört", "t shirt"] }`. */
export const AdminPostSearchSynonym = z
  .object({
    terms: z
      .array(term)
      .max(MAX_SENT)
      .refine((terms) => terms.length >= MIN_TERMS, { message: "search.synonym_terms_too_few" })
      .refine((terms) => terms.length <= MAX_TERMS, { message: "search.synonym_terms_too_many" }),
  })
  .strict()
export type AdminPostSearchSynonymType = z.infer<typeof AdminPostSearchSynonym>
