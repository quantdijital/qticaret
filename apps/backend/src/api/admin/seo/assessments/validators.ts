import { z } from "@medusajs/framework/zod"
import { ASSESSED_KINDS } from "../../../../modules/seo-advisor/models/seo-assessment"

/**
 * `?kind=product&max_score=69&ids=a,b`: stored assessments, lowest score
 * first; `ids` asks for the pages a list shows (100 at most).
 */
export const AdminGetAssessments = z
  .object({
    kind: z.enum(ASSESSED_KINDS).default("product"),
    max_score: z.coerce.number().int().min(0).max(100).optional(),
    ids: z
      .string()
      .max(5000)
      .transform((value) => value.split(",").filter(Boolean))
      .pipe(z.array(z.string().max(64)).max(100))
      .optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
export type AdminGetAssessmentsType = z.infer<typeof AdminGetAssessments>
