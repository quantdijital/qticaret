import {
  FOOTER_APP_HOSTS,
  FOOTER_BLOCK_MAX,
  FOOTER_BLOCK_TYPES,
  FOOTER_ROWS_LIMITS as L,
  NEWSLETTER_LIMITS,
  footerRowColumns,
} from "@qticaret/types"
import { docText } from "@/features/content/doc-text"
import type {
  FooterBlock,
  FooterRowsSection,
  FooterSection,
} from "@/features/storefront/api/layout"
import { linkProblem, textProblem } from "./problems"
import type { Problem, SectionProblems } from "./problems"

/**
 * What the server would refuse in a free rows footer (adr/0070 §2), found
 * before the save, so the draft waits instead of failing: a block's field
 * under `blocks.<id>.<field>`, a row's under `rows.<id>`, the footer's own
 * under `rows`, `blocks` and `newsletter`. The tree marks a row or block
 * with any of its own.
 */

type Found = [string, Problem | null]

/** An app's page: https on exactly its store's host, as the server checks. */
export function appUrlProblem(value: string | null, host: string): Problem | null {
  if (value === null) {
    return null
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" &&
      url.hostname === host &&
      url.port === "" &&
      url.username === "" &&
      !/\s/.test(value)
      ? null
      : "footerBlockInvalid"
  } catch {
    return "footerBlockInvalid"
  }
}

function blockProblems(block: FooterBlock): Found[] {
  const at = (field: string) => `blocks.${block.id}.${field}`
  const title = (max: number = L.title, tokens = false): Found => [
    at("title"),
    "title" in block ? textProblem(block.title, max, tokens) : null,
  ]
  switch (block.type) {
    case "text":
      return [title(), [at("body"), docText(block.body).length > L.textChars ? "tooLong" : null]]
    case "menu":
    case "social":
    case "payments":
    case "contact":
      return [title()]
    case "brand":
      return [[at("about"), textProblem(block.about, L.about)]]
    case "newsletter":
      return [
        title(L.newsletterTitle),
        [at("text"), textProblem(block.text, L.newsletterText, true)],
        [at("description"), textProblem(block.description, NEWSLETTER_LIMITS.description, true)],
      ]
    case "image":
      return [
        [
          at("image"),
          block.image === null
            ? "imageRequired"
            : (block.image.alt ?? "").trim() === ""
              ? "required"
              : textProblem(block.image.alt, L.alt),
        ],
        [at("link"), linkProblem(block.link)],
      ]
    case "app_badges":
      return [
        [
          at("app_store"),
          block.app_store === null && block.google_play === null
            ? "required"
            : appUrlProblem(block.app_store, FOOTER_APP_HOSTS.app_store),
        ],
        [at("google_play"), appUrlProblem(block.google_play, FOOTER_APP_HOSTS.google_play)],
      ]
    case "trust":
      return []
  }
}

/**
 * The footer's problems; `group` the footer group around it (its
 * newsletter box would make a second form on the page).
 */
export function footerRowsProblems(
  section: FooterRowsSection,
  group: readonly FooterSection[]
): SectionProblems {
  const blocks = section.rows.flatMap((row) => row.columns.flatMap((column) => column.blocks))
  const overType = FOOTER_BLOCK_TYPES.some(
    (type) => blocks.filter((block) => block.type === type).length > FOOTER_BLOCK_MAX[type]
  )
  const box = group.some((each) => each.type === "newsletter" && each.visible)
  const found: Found[] = [
    ["rows", section.rows.length < 1 || section.rows.length > L.rows ? "footerRowsLimit" : null],
    ["blocks", blocks.length > L.blocks || overType ? "footerBlocksLimit" : null],
    [
      "newsletter",
      box && blocks.some((block) => block.type === "newsletter") ? "footerNewsletterTwice" : null,
    ],
    ...section.rows.map((row): Found => [
      `rows.${row.id}`,
      row.columns.length !== footerRowColumns(row.layout)
        ? "footerColumnsMismatch"
        : row.columns.some((column) => column.blocks.length > L.perColumn)
          ? "footerBlocksLimit"
          : null,
    ]),
    ...blocks.flatMap(blockProblems),
  ]
  return Object.fromEntries(found.filter((entry): entry is [string, Problem] => entry[1] !== null))
}

/**
 * A newsletter box in the footer group drawn "in the footer" while the
 * footer is in free rows: its place is a block there (adr/0070 §4), the
 * server refuses it.
 */
export function footerBandProblem(
  section: FooterSection,
  group: readonly FooterSection[]
): Problem | null {
  const free = group.some((each) => each.type === "footer_bar" && each.variant === "free_rows")
  return free && section.type === "newsletter" && section.visible && section.variant === "in_footer"
    ? "footerNewsletterBand"
    : null
}

/** Whether a row or a block of the footer has a problem of its own. */
export const partHasProblem = (problems: SectionProblems, prefix: string): boolean =>
  Object.keys(problems).some((key) => key === prefix || key.startsWith(`${prefix}.`))
