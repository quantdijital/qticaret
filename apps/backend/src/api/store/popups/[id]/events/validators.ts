import { z } from "@medusajs/framework/zod"
import { POPUP_EVENTS } from "../../../../../lib/popups/rules"

/** What the storefront counts for a pop-up (adr/0080 §7): the event's name only. */
export const StorePostPopupEvent = z.object({ type: z.enum(POPUP_EVENTS) }).strict()
export type StorePostPopupEventType = z.infer<typeof StorePostPopupEvent>
