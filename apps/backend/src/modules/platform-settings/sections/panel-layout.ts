import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

/**
 * How one of the panel's record pages is laid out for the whole team: the
 * order of each column's parts and the parts the shop hid. Saved by the
 * owner (or an admin) once, read by everyone. A part is named by the
 * panel's own key; the panel ignores a key it no longer knows and puts a
 * part it does not find here at its default place, so the server keeps
 * only the shape (short keys, bounded lists). Empty lists: the default.
 */
export interface PageLayout {
  main: string[]
  side: string[]
  hidden: string[]
}

/** The panel's page layouts (the owner, 2026-11-25: "bölümleri gizleyebilsin, yerini değiştirebilsin"). */
export interface PanelLayoutSettings {
  /** The product page (docs/06 "Ürün sayfası"). */
  product: PageLayout
}

const PART_KEY = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/)
const PARTS = z.array(PART_KEY).max(40)

export const panelLayoutSection = defineSection<PanelLayoutSettings>(
  "panel_layout",
  {
    product: z.object({ main: PARTS, side: PARTS, hidden: PARTS }).strict(),
  },
  { product: { main: [], side: [], hidden: [] } }
)
