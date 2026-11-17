import { FOOTER_ROWS_DEFAULTS } from "@qticaret/types/section-footer-rows"
import type { Section } from "./preset-resolve"

/**
 * The `free_rows` footer's own part of `main.footer_bar` as the store API
 * prints it (`footerRowsOf`, apps/backend/src/lib/storefront/sections/
 * footer-rows-print.ts): the variant's ground and marks, its rows, each
 * shown block with `at` (its place in the design, hidden ones counted)
 * and without `visible`. A picture comes as written (no library here); a
 * text block's document is the backend's HTML, which this fixture does not
 * draw: a preset with one fails here until it is written in.
 */

type Raw = Record<string, unknown>

const list = (value: unknown): Raw[] => (Array.isArray(value) ? (value as Raw[]) : [])

/** The keys the rows carry for the editor alone, or print apart (`id`, `device`). */
const NOT_OWN = new Set(["id", "visible", "device"])

function printedBlock(block: Raw): Raw {
  const own = Object.fromEntries(Object.entries(block).filter(([key]) => !NOT_OWN.has(key)))
  if (own["type"] === "text") {
    throw new Error(
      `preset lock: footer text block ${String(block["id"])} is not printed by the fixture`
    )
  }
  if (own["type"] === "image") {
    const image = own["image"] as Raw
    return {
      ...own,
      image: { url: image["url"], alt: image["alt"], width: null, height: null, derivatives: null },
    }
  }
  return own
}

export function footerRowsPrint(bar: Section): Raw {
  let at = 0
  const rows = list(bar["rows"]).map((row) => ({
    ...row,
    columns: list(row["columns"]).map((column) => ({
      blocks: list(column["blocks"]).flatMap((block) => {
        const place = at
        at += 1
        return block["visible"] === false
          ? []
          : [{ id: block["id"], at: place, device: block["device"], ...printedBlock(block) }]
      }),
    })),
  }))
  return {
    ground: bar["ground"] ?? FOOTER_ROWS_DEFAULTS.ground,
    badge_style: bar["badge_style"] ?? FOOTER_ROWS_DEFAULTS.badge_style,
    bottom_badges: bar["bottom_badges"] ?? FOOTER_ROWS_DEFAULTS.bottom_badges,
    rows,
  }
}
