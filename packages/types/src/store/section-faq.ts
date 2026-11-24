import type { FaqVariant } from "./section-variants.js"

/**
 * The FAQ section's settings (`faq`, docs/tema/bilesen-denetimi (b) 8,
 * 1.14): whether the first question comes open, and whether opening one
 * closes the one open before it. Named `off`/`on` steps (bilesen-standardi
 * §3's rule for a switch that may take a third step), both off by default:
 * every question closed and each opened on its own, as before. The
 * contract's list: a new step goes here first, then into the backend's
 * mirror (`lib/storefront/sections/faq.ts`, a test keeps them equal), then
 * into the themes. The panel's Turkish names are
 * `storefront.editor.faq.<setting>.*`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-faq` subpath).
 */
export const FAQ_SETTINGS = {
  /** The first question open when the page comes (its answer is in the HTML either way). */
  open_first: ["off", "on"],
  /** Opening a question closes the one open before it (an accordion). */
  single_open: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FaqSetting = keyof typeof FAQ_SETTINGS
export type FaqStep<S extends FaqSetting> = (typeof FAQ_SETTINGS)[S][number]

/** A new section's settings, and what one saved before them reads as: all closed, each on its own. */
export const FAQ_DEFAULTS: { readonly [S in FaqSetting]: FaqStep<S> } = {
  open_first: "off",
  single_open: "off",
}

/** The settings in the order the panel offers them. */
export const FAQ_SETTING_NAMES = Object.keys(FAQ_SETTINGS) as FaqSetting[]

/** The section's settings as the design keeps them. */
export type FaqSettings = { [S in FaqSetting]: FaqStep<S> }

/** Every setting as a reader takes it: one missing or not on this build's list reads as its default. */
export function faqSettingsOf(section: Partial<Record<FaqSetting, unknown>>): FaqSettings {
  const settings: Partial<Record<FaqSetting, string>> = {}
  for (const name of FAQ_SETTING_NAMES) {
    const steps: readonly unknown[] = FAQ_SETTINGS[name]
    settings[name] = steps.includes(section[name]) ? (section[name] as string) : FAQ_DEFAULTS[name]
  }
  return settings as FaqSettings
}

/**
 * The FAQ's items (adr/0073 Ek 2026-11-24 (2)): the shop writes each
 * question and its answer itself, nothing is read out of a text. A row is
 * a question with its answer (a short rich text: paragraphs, lists, bold,
 * italic and links, as a footer text block's) or a group's heading, the
 * questions under it until the next. An answer saved before rich answers
 * is plain text (`answer`) and reads as it was. The bounds: a question's
 * and a heading's characters, an answer's characters of text, and the
 * rows a section holds. Mirrored by the backend's `sections/faq.ts`; a
 * unit test keeps them equal.
 */
export const FAQ_LIMITS = {
  question: 200,
  heading: 120,
  /** A plain answer saved before rich answers. */
  answer: 600,
  /** An answer's characters of text (its document's, as a footer block's are counted). */
  answerChars: 1500,
  items: 40,
} as const

/** The variants only a content page's FAQ takes: `page`, drawn as a questions page. */
export const FAQ_PAGE_VARIANTS = ["page"] as const satisfies readonly FaqVariant[]

/** Whether an FAQ outside the content pages may take the variant. */
export const faqOffPages = (variant: FaqVariant): boolean =>
  !(FAQ_PAGE_VARIANTS as readonly string[]).includes(variant)

/**
 * One FAQ row as the store API prints it: a question with its answer as
 * the backend's HTML (from its allow-listed document, adr/0019), a
 * question with a plain answer saved before rich answers (its `{tokens}`
 * filled), or a group's heading.
 */
export type StoreFaqItem =
  { question: string; html: string } | { question: string; answer: string } | { heading: string }

/** Whether a printed row is a group's heading. */
export const isFaqHeading = (item: StoreFaqItem): item is { heading: string } => "heading" in item
