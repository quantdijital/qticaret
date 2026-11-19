import type { StorefrontPreset } from "@qticaret/sector-packs"
import { ABOUT_PAGE, CONTACT_PAGE, CONTENT_ENTRIES, STORY_PAGE } from "./fixture-content"
import { presetAnswer } from "./store-layout"
import type { Section } from "./preset-resolve"

/**
 * A preset's own content page layouts in the fixed shop (adr/0073 §4,
 * S5): each page the preset lays out by `{ "$handle": "page:<handle>" }`
 * that the fixture has (`fixture-content.ts`) is drawn with the preset's
 * sections, kept as `<pack>-<code>/<file>` beside its frame and home page.
 * A page the fixture has not is named at the top of the snapshot, as the
 * backend names it in `skipped`. The sections are read as the backend
 * reads a page's (`presetAnswer`'s category group keeps their place), a
 * rich text's document printed as `storeLayout` prints it.
 */

/** Each fixture page's snapshot, by its handle. */
const FILES: ReadonlyMap<string, string> = new Map([
  [ABOUT_PAGE.handle, "about.html"],
  [CONTACT_PAGE.handle, "contact.html"],
  [STORY_PAGE.handle, "story.html"],
])

/** The fixed shop's name, as the store details give it (`fake-store-api.ts`). */
const SHOP_NAME = "Örnek Atölye"

interface DocNode {
  type: string
  text?: string
  attrs?: { level?: number }
  marks?: { type: string }[]
  content?: DocNode[]
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)

/** A shop detail's token filled as the backend fills it (`fillShopDoc`); the fixture has its name. */
const filled = (text: string) => text.normalize("NFC").replaceAll("{mağaza_adı}", SHOP_NAME)

function inline(node: DocNode): string {
  let html = escapeHtml(filled(node.text ?? ""))
  if (node.marks?.some((mark) => mark.type === "italic")) html = `<em>${html}</em>`
  if (node.marks?.some((mark) => mark.type === "bold")) html = `<strong>${html}</strong>`
  return html
}

/** The paragraphs and headings a preset's rich text holds, as `renderDoc` prints them. */
function docHtml(doc: unknown): string {
  return ((doc as DocNode | null)?.content ?? [])
    .map((block) => {
      const html = (block.content ?? []).map(inline).join("")
      if (!html) return ""
      if (block.type === "heading") {
        const level = String(block.attrs?.level ?? 2)
        return `<h${level}>${html}</h${level}>`
      }
      if (block.type === "paragraph") return `<p>${html}</p>`
      throw new Error(`preset lock: a rich text's ${block.type} is not printed here`)
    })
    .join("")
}

/** A section as `GET /store/storefront-layout/pages/:id` prints it (`hydrateSection`). */
function printed(section: Section): Section {
  if (section.type !== "rich_text") return section
  const { body, variant, image, image_side: side, placement, look, device, ...rest } = section
  const out: Section = { ...rest, title: section["title"] ?? null, html: docHtml(body) }
  if (variant === "with_image") {
    Object.assign(out, { variant, image, image_side: side ?? "start" })
  }
  return { ...out, ...(look ? { look } : {}), ...(device ? { device } : {}), placement }
}

export interface PresetContentPage {
  /** The snapshot's name in the preset's folder. */
  file: string
  page: (typeof CONTENT_ENTRIES)[number]
}

/**
 * The fixture pages `preset` lays out, with their layouts as the store
 * answers them (by page id), and what the fixture lacks (its notes).
 */
export function presetContentPages(preset: StorefrontPreset): {
  pages: PresetContentPage[]
  layouts: Record<string, unknown>
  notes: string[]
} {
  const pages: PresetContentPage[] = []
  const layouts: Record<string, unknown> = {}
  const notes: string[] = []
  for (const entry of preset.layout.pages ?? []) {
    const handle = entry.page_id.$handle.slice("page:".length)
    const page = CONTENT_ENTRIES.find((each) => each.handle === handle)
    const file = FILES.get(handle)
    if (!page || !file) {
      notes.push(`<!-- not in the fixture shop: pages ${entry.page_id.$handle} -->`)
      continue
    }
    const read = presetAnswer({ ...preset, layout: { ...preset.layout, category: entry.sections } })
    const sections = (read.layout.category as unknown as Section[]).map(printed)
    // The page's sections stood in the category group: what they lacked, named as the page's
    const own = (list: string[]) =>
      list
        .filter((each) => each.startsWith("category."))
        .map((each) => `pages.${handle}.${each.slice("category.".length)}`)
    notes.push(
      ...own(read.skipped).map((each) => `<!-- not in the fixture shop: ${each} -->`),
      ...own(read.dropped).map((each) => `<!-- section dropped: ${each} -->`)
    )
    layouts[page.id] = { page_id: page.id, sections }
    pages.push({ file, page })
  }
  return { pages, layouts, notes }
}
