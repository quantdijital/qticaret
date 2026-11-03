/**
 * WordPress shortcodes (`[name attr="…"]…[/name]`) as a theme or plugin
 * wrote them into a text: layout ones (Flatsome's `[section]`, `[row]`,
 * `[col]`, `[ux_text]`) give up their tags and keep what they hold; a
 * question-and-answer item (`[sss_item soru="…"]`, `[accordion-item
 * title="…"]`) keeps its question as a heading; product grids, galleries,
 * blocks and embeds are dropped and counted. Never run: a tag is only
 * ever taken out or swapped for a heading's markup of its quoted text.
 */

// A shortcode's tag: a lowercase name, so "[Not]" or "[1]" in a sentence stay text
const TAG = /\[(\/?)([a-z][a-z0-9_-]{0,40})((?:\s[^[\]]{0,2000})?)\/?\]/g
const ATTRIBUTE = /([a-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi

// Items whose question is an attribute, and its names
const QUESTION_ITEMS: Readonly<Record<string, readonly string[]>> = {
  sss_item: ["soru", "question", "title"],
  "accordion-item": ["title"],
  accordion_item: ["title"],
  faq_item: ["question", "title"],
  toggle: ["title"],
  tab: ["title"],
}
// Shortcodes whose content is no text (an address, a player's settings): gone with it
const OPAQUE: ReadonlySet<string> = new Set(["embed", "video", "audio", "playlist", "ux_video"])
// What draws something from the old site's data: a product grid, a gallery, a saved block
const WIDGET =
  /(^|_)(products?|product_categories|gallery|block|slider|banner|map|image|form|countdown|portfolio)(_|$)|contact-form/

export interface Expanded {
  html: string
  /** Shortcodes that drew something no text can keep (a product grid, a gallery). */
  widgets: number
}

function attributesOf(text: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of text.matchAll(ATTRIBUTE)) {
    const name = match[1]?.toLowerCase()
    if (name && !found.has(name)) {
      found.set(name, match[2] ?? match[3] ?? "")
    }
  }
  return found
}

// Quoted text going into markup: its own markup made harmless
const escaped = (text: string) =>
  text
    .replace(/&(?![#a-z0-9]+;)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

/** The text without its shortcodes, their contents kept but for the opaque ones. */
export function expandShortcodes(text: string): Expanded {
  const parts: string[] = []
  let widgets = 0
  let at = 0
  TAG.lastIndex = 0
  for (let match = TAG.exec(text); match; match = TAG.exec(text)) {
    const [whole, closing, name = "", rest = ""] = match
    parts.push(text.slice(at, match.index))
    at = match.index + whole.length
    if (closing) {
      continue
    }
    if (OPAQUE.has(name)) {
      const end = text.indexOf(`[/${name}]`, at)
      at = end === -1 ? at : end + name.length + 3
      TAG.lastIndex = at
      widgets += 1
      continue
    }
    const keys = QUESTION_ITEMS[name]
    if (keys) {
      const attributes = attributesOf(rest)
      const question = keys.map((key) => attributes.get(key)).find((value) => value?.trim())
      if (question) {
        parts.push(`<h3>${escaped(question.trim())}</h3>`)
      }
      continue
    }
    if (WIDGET.test(name)) {
      widgets += 1
    }
  }
  parts.push(text.slice(at))
  return { html: parts.join(""), widgets }
}
