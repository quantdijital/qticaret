import { z } from "@medusajs/framework/zod"
import { ADDONS_MAX, ADDON_TEXT_MAX } from "../../../../../../../lib/catalog/addons"

const id = z.string().min(1).max(64)

/**
 * A line's add-on picks (adr/0052 §3): each names an add-on of the line's
 * product, with the text typed or the choice picked. No price, no unit
 * price, no `qt_` record: the server works those out (rule 5); anything
 * else in the body is refused. An empty list takes the add-ons off.
 */
export const StorePostLineAddons = z
  .object({
    selections: z
      .array(
        z
          .object({
            addon_id: id,
            // Room for spaces the server collapses; its add-on's own limit is checked after
            value: z
              .string()
              .refine((text) => text.length <= ADDON_TEXT_MAX * 4, {
                message: "addons.text_too_long",
              })
              .optional(),
            choice_id: id.optional(),
          })
          .strict()
      )
      .refine((selections) => selections.length <= ADDONS_MAX, { message: "addons.too_many" }),
  })
  .strict()

export type StorePostLineAddonsType = z.infer<typeof StorePostLineAddons>
