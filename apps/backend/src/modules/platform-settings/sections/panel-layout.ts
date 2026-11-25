import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

/**
 * How one of the panel's record pages is laid out for the whole team: the
 * order of each column's parts, the parts the shop hid and the folded
 * parts that start open. Saved by the owner (or an admin) once, read by
 * everyone. A part is named by the panel's own key; the panel ignores a
 * key it no longer knows and puts a part it does not find here at its
 * default place, so the server keeps only the shape (short keys, bounded
 * lists, each key once). Empty lists: the default.
 */
export interface PageLayout {
  main: string[]
  side: string[]
  hidden: string[]
  /** Folded parts that start open ("Gelişmiş"); a person's own choice still wins. */
  open: string[]
}

/** The panel's page layouts (the owner, 2026-11-25: "bölümleri gizleyebilsin, yerini değiştirebilsin"). */
export interface PanelLayoutSettings {
  /** The product page (docs/06 "Ürün sayfası"). */
  product: PageLayout
}

const PART_KEY = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/)
const PARTS = z.array(PART_KEY).max(40)

/** Each list names a part once, and a part stands in one column only. */
export function layoutIssues(layout: PageLayout): { message: string; path: string[] }[] {
  const issues: { message: string; path: string[] }[] = []
  for (const list of ["main", "side", "hidden", "open"] as const) {
    if (new Set(layout[list]).size !== layout[list].length) {
      issues.push({ message: "platform_settings.layout_duplicate", path: ["product", list] })
    }
  }
  const main = new Set(layout.main)
  if (layout.side.some((key) => main.has(key))) {
    issues.push({ message: "platform_settings.layout_duplicate", path: ["product", "side"] })
  }
  return issues
}

export const panelLayoutSection = defineSection<PanelLayoutSettings>(
  "panel_layout",
  {
    // `open` came later: a layout saved before it reads as none open
    product: z
      .object({ main: PARTS, side: PARTS, hidden: PARTS, open: PARTS.default([]) })
      .strict(),
  },
  { product: { main: [], side: [], hidden: [], open: [] } },
  (values, ctx) => {
    for (const issue of layoutIssues(values.product)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path })
    }
  }
)
