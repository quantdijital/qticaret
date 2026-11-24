import { z } from "zod"
import { POPUP_TYPES } from "./api/types"

/** The list's URL: `/popups?q=yaz&type=campaign&page=2` (1-based in the URL). */
export const popupsSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  type: z.enum(POPUP_TYPES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type PopupsSearch = z.infer<typeof popupsSearchSchema>

/** A new pop-up's URL: `/popups/new?type=newsletter`; without one, the type is asked first. */
export const newPopupSearchSchema = z.object({
  type: z.enum(POPUP_TYPES).optional().catch(undefined),
})
