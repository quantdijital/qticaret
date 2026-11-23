import { z } from "@medusajs/framework/zod"
import { SEARCH_TEXT_MAX } from "../../../../lib/ai/search-intent/types"
import { isCleanText } from "../../../../lib/security/text"

// One line, as typed: line breaks and runs of spaces become one space
const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim()

/** A shopper's sentence for "search in your own words" (adr/0077 §7). */
export const StorePostSearchInterpret = z
  .object({
    text: z
      .string()
      .max(SEARCH_TEXT_MAX * 2)
      .transform(oneLine)
      .pipe(
        z
          .string()
          .min(1)
          .max(SEARCH_TEXT_MAX)
          .refine((text) => isCleanText(text), { message: "search.text_invalid" })
      ),
  })
  .strict()

export type StorePostSearchInterpretType = z.infer<typeof StorePostSearchInterpret>
