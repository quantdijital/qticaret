import type { AnySection, LayoutDocument, LayoutLink } from "@/features/storefront/api/layout"
import { DEPARTURES_LIMITS, HEADER_CATALOG_LIMITS, SEARCH_BOX_LIMITS } from "@qticaret/types"
import { LAYOUT_LIMITS as L, MARQUEE_LIMITS, SLIDER_LIMITS } from "@/features/storefront/api/layout"
import { isCleanText } from "@/features/settings/storefront"
import { unknownShopTokens } from "@/features/settings/shop-tokens"
import { heroCatalogProblems, heroFullProblems, priceBandsProblems } from "./catalog-problems"
import { listProblems } from "./shelf-problems"
import { stripGalleryProblems } from "./strip-problems"
import { collageProblems, statsProblems, stepsProblems } from "./points-problems"
import { postsProblems, splitEyebrowProblem } from "./band-problems"
import { marqueeLimitIds } from "./page-limits"
import { footerBandProblem, footerRowsProblems } from "./footer-rows-problems"
import { faqProblems } from "./faq-problems"
import { allSections } from "./sections"
import { SETTINGS_KEY, badgeProblems, settingsProblems } from "./settings-problems"

/**
 * What the server would refuse in a section, found before the save: the
 * editor marks the field and waits instead of sending a draft it knows
 * will fail. Each problem is a key under `storefront.editor.problems`.
 */
export type Problem =
  | "required"
  | "questionRequired"
  | "answerRequired"
  | "tooLong"
  | "textInvalid"
  | "tokenUnknown"
  | "linkLabel"
  | "slidesRequired"
  | "slidesTwo"
  | "stripsTwo"
  | "imageRequired"
  | "productsRequired"
  | "productRequired"
  | "categoryRequired"
  | "collectionRequired"
  | "brandRequired"
  | "daysRange"
  | "scheduleOrder"
  | "colorInvalid"
  | "colorDuplicate"
  | "contrast"
  | "wellContrast"
  | "thresholdRange"
  | "marqueeLimit"
  | "bandsOrder"
  | "bandsLimit"
  | "footerRowsLimit"
  | "footerBlocksLimit"
  | "footerColumnsMismatch"
  | "footerBlockInvalid"
  | "footerNewsletterTwice"
  | "footerNewsletterBand"

/** A section's problems by field (`heading`, `lines.0`, `slides.1.text`, `schedule`). */
export type SectionProblems = Record<string, Problem>

/** A written text: within `max`, no control characters, and (`tokens`) only the shop's details. */
export function textProblem(value: string | null, max: number, tokens = false): Problem | null {
  if (value === null) {
    return null
  }
  const text = value.trim()
  if (text.length > max) {
    return "tooLong"
  }
  if (!isCleanText(text)) {
    return "textInvalid"
  }
  return tokens && unknownShopTokens(text).length > 0 ? "tokenUnknown" : null
}

/** A link's own wording: an address must have one. */
export function linkProblem(link: LayoutLink | null): Problem | null {
  if (!link) {
    return null
  }
  if (link.kind === "url" && link.label.trim() === "") {
    return "linkLabel"
  }
  return textProblem(link.label, L.label)
}

/** The end must come after the start. */
export function scheduleProblem(section: Pick<AnySection, "starts_at" | "ends_at">) {
  const { starts_at: starts, ends_at: ends } = section
  return starts && ends && new Date(ends).getTime() <= new Date(starts).getTime()
    ? "scheduleOrder"
    : null
}

type Found = [string, Problem | null]

function fieldsOf(section: AnySection): Found[] {
  switch (section.type) {
    case "announcement_bar":
      return section.lines.map((line, index): Found => [
        `lines.${String(index)}`,
        line.trim() === "" ? "required" : textProblem(line, L.line, true),
      ])
    case "hero":
      return [
        ["eyebrow", textProblem(section.eyebrow, L.eyebrow, true)],
        ["heading", textProblem(section.heading, L.heading, true)],
        ["text", textProblem(section.text, L.text, true)],
        ["image", textProblem(section.image?.alt ?? null, L.alt)],
        ...section.links.map((link, index): Found => [`links.${String(index)}`, linkProblem(link)]),
        ...heroCatalogProblems(section),
        ...heroFullProblems(section),
      ]
    case "price_bands":
      return priceBandsProblems(section)
    case "strip_gallery":
      return stripGalleryProblems(section)
    case "stats":
      return statsProblems(section)
    case "steps":
      return stepsProblems(section)
    case "search_box":
      return [
        ["title", textProblem(section.title, L.title)],
        ["intro", textProblem(section.intro, SEARCH_BOX_LIMITS.intro, true)],
      ]
    case "photo_collage":
      return collageProblems(section)
    // Upcoming departures: their category or collection chosen, the intro's length (adr/0077 §10)
    case "departures": {
      const { source } = section
      return [
        ["title", textProblem(section.title, L.title)],
        ["intro", textProblem(section.intro, DEPARTURES_LIMITS.intro)],
        [
          "source",
          source.kind === "category" && source.category_id === ""
            ? "categoryRequired"
            : source.kind === "collection" && source.collection_id === ""
              ? "collectionRequired"
              : null,
        ],
      ]
    }
    case "banner":
      return [
        ["slides", section.slides.length === 0 ? "slidesRequired" : null],
        // The split's upper line (adr/0077 Ek)
        ["eyebrow", section.variant === "split" ? splitEyebrowProblem(section) : null],
        ...section.slides.flatMap((slide, index): Found[] => {
          const at = `slides.${String(index)}`
          return [
            [`${at}.image`, textProblem(slide.image.alt, L.alt)],
            [`${at}.mobile_image`, textProblem(slide.mobile_image?.alt ?? null, L.alt)],
            [`${at}.heading`, textProblem(slide.heading, L.heading, true)],
            [`${at}.text`, textProblem(slide.text, L.slideText, true)],
            [`${at}.link`, linkProblem(slide.link)],
            [`${at}.second_link`, linkProblem(slide.second_link)],
          ]
        }),
      ]
    case "hero_slider":
      return [
        ["slides", section.slides.length < SLIDER_LIMITS.slides.min ? "slidesTwo" : null],
        ...section.slides.flatMap((slide, index): Found[] => {
          const at = `slides.${String(index)}`
          return [
            [`${at}.image`, textProblem(slide.image.alt, L.alt)],
            [`${at}.mobile_image`, textProblem(slide.mobile_image?.alt ?? null, L.alt)],
            [`${at}.heading`, textProblem(slide.heading, L.heading, true)],
            [`${at}.text`, textProblem(slide.text, L.slideText, true)],
            [`${at}.link`, linkProblem(slide.link)],
          ]
        }),
      ]
    case "products": {
      // The rail's own list, then a columns rail's more, each under its prefix
      const lists = section.variant === "columns" ? (section.lists ?? []) : []
      return [
        ...listProblems("", section),
        ...lists.flatMap((list, index) => listProblems(`lists.${String(index)}.`, list)),
        ["more", linkProblem(section.more)],
      ]
    }
    case "related_products": {
      const { source } = section
      return [
        ["title", textProblem(section.title, L.title)],
        [
          "source",
          source.kind === "manual" && source.product_ids.length === 0
            ? "productsRequired"
            : source.kind === "collection" && source.collection_id === ""
              ? "collectionRequired"
              : null,
        ],
      ]
    }
    case "faq":
      return [["title", textProblem(section.title, L.title)], ...faqProblems(section.items)]
    case "newsletter":
    case "help":
      return [
        ["title", textProblem(section.title, L.title)],
        ["text", textProblem(section.text, L.text, true)],
      ]
    case "featured_product":
      return [
        ["title", textProblem(section.title, L.title)],
        ["text", textProblem(section.text, L.text, true)],
        ["product_id", section.product_id === "" ? "productRequired" : null],
      ]
    case "categories":
      return [
        ["title", textProblem(section.title, L.title)],
        ["more", linkProblem(section.more)],
      ]
    case "rich_text":
      // The picture beside it (adr/0073 §3): the draft waits for one
      return [
        ["title", textProblem(section.title, L.title)],
        [
          "image",
          section.variant !== "with_image"
            ? null
            : section.image
              ? textProblem(section.image.alt, L.alt)
              : "imageRequired",
        ],
      ]
    case "posts":
      return postsProblems(section)
    case "brands":
    case "reviews":
    case "google_rating":
      return [["title", textProblem(section.title, L.title)]]
    case "header_bar":
      // The catalog header's words and highlighted link (adr/0049 Ek 2026-11-15)
      return section.variant === "catalog"
        ? [
            [
              "search_placeholder",
              textProblem(section.search_placeholder, HEADER_CATALOG_LIMITS.search_placeholder),
            ],
            ["highlight_link", linkProblem(section.highlight_link)],
            ["strip_note", textProblem(section.strip_note, HEADER_CATALOG_LIMITS.strip_note)],
            ["strip_note_link", linkProblem(section.strip_note_link)],
          ]
        : []
    // A content page's own: the contact text is checked on the server, the facts have no fields
    case "footer_bar":
    case "product_main":
    case "category_main":
    case "trust_badges":
    case "contact":
    case "payment_facts":
    case "shipping_facts":
      return []
    case "marquee":
      return section.items.flatMap((item, index): Found[] => {
        const at = `items.${String(index)}`
        return [
          [
            `${at}.text`,
            item.text.trim() === ""
              ? "required"
              : textProblem(item.text, MARQUEE_LIMITS.text, true),
          ],
          [`${at}.subtext`, textProblem(item.subtext, MARQUEE_LIMITS.subtext, true)],
          [`${at}.link`, linkProblem(item.link)],
        ]
      })
  }
}

/** The section's problems; none: it may be saved as it is. */
export function sectionProblems(section: AnySection): SectionProblems {
  const found: Found[] = [...fieldsOf(section), ["schedule", scheduleProblem(section)]]
  return Object.fromEntries(found.filter((entry): entry is [string, Problem] => entry[1] !== null))
}

/**
 * The sections with a problem, by id, and the theme's shared settings'
 * under `SETTINGS_KEY`; an empty map: the draft may be saved. Every trust
 * strip section carries the badges' problems too: the one list is edited
 * in each strip's form (adr/0049 Ek 2026-11-06). `savedTheme`, the draft's
 * theme as the server holds it, judges a colour change against the page's
 * well (adr/0062 §6).
 */
export function documentProblems(
  doc: LayoutDocument,
  savedTheme?: LayoutDocument["settings"]["theme"]
): Map<string, SectionProblems> {
  const problems = new Map<string, SectionProblems>()
  const settings = settingsProblems(doc.settings, savedTheme)
  const badges = badgeProblems(settings)
  const overLimit = marqueeLimitIds(doc)
  for (const section of allSections(doc)) {
    const found: SectionProblems = {
      ...sectionProblems(section),
      ...(section.type === "trust_badges" ? badges : {}),
      // The free rows footer's rows and blocks, and a newsletter box with no place beside it (adr/0070)
      ...(section.type === "footer_bar" && section.variant === "free_rows"
        ? footerRowsProblems(section, doc.footer)
        : {}),
      ...(section.type === "newsletter" &&
      doc.footer.some((each) => each === section) &&
      footerBandProblem(section, doc.footer)
        ? { variant: "footerNewsletterBand" as const }
        : {}),
      ...(overLimit.has(section.id)
        ? {
            limit:
              section.type === "price_bands" ? ("bandsLimit" as const) : ("marqueeLimit" as const),
          }
        : {}),
    }
    if (Object.keys(found).length > 0) {
      problems.set(section.id, found)
    }
  }
  if (Object.keys(settings).length > 0) {
    problems.set(SETTINGS_KEY, settings)
  }
  return problems
}
