import { FOOTER_ROWS_DEFAULTS } from "@qticaret/types/section-footer-rows"
import type { Section } from "./preset-resolve"

/**
 * The `free_rows` footer's own part of `main.footer_bar` as the store API
 * prints it (`footerRowsOf`, apps/backend/src/lib/storefront/sections/
 * footer-rows-print.ts): the variant's ground and marks, its rows, each
 * shown block with `at` (its place in the design, hidden ones counted)
 * and without `visible`. A picture comes as written (no library here); a
 * text block's document as the backend's `renderDoc` draws plain
 * paragraphs and line breaks (`<p>`, `<br>`); a list or a mark, which this
 * fixture does not draw, fails here until it is written in.
 */

type Raw = Record<string, unknown>

const list = (value: unknown): Raw[] => (Array.isArray(value) ? (value as Raw[]) : [])

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)

/** A plain document's HTML: its paragraphs, their text and line breaks, as `renderDoc` writes them. */
function plainHtml(id: unknown, body: unknown): string {
  const fail = () => {
    throw new Error(`preset lock: footer text block ${String(id)} is not a plain document`)
  }
  const doc = body as Raw
  return list(doc["content"])
    .map((paragraph) => {
      if (paragraph["type"] !== "paragraph") {
        fail()
      }
      const html = list(paragraph["content"])
        .map((node) => {
          if (node["type"] === "hardBreak") {
            return "<br>"
          }
          if (node["type"] !== "text" || node["marks"] !== undefined) {
            fail()
          }
          return escapeHtml(String(node["text"]))
        })
        .join("")
      return html ? `<p>${html}</p>` : ""
    })
    .join("")
}

/** The keys the rows carry for the editor alone, or print apart (`id`, `device`). */
const NOT_OWN = new Set(["id", "visible", "device"])

function printedBlock(block: Raw): Raw {
  const own = Object.fromEntries(Object.entries(block).filter(([key]) => !NOT_OWN.has(key)))
  if (own["type"] === "text") {
    const { body, ...rest } = own
    return { ...rest, html: plainHtml(block["id"], body), style: own["style"] ?? "plain" }
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
    legal_place: bar["legal_place"] ?? FOOTER_ROWS_DEFAULTS.legal_place,
    bottom_badges: bar["bottom_badges"] ?? FOOTER_ROWS_DEFAULTS.bottom_badges,
    rows,
  }
}
