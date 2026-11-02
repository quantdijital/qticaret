import type {
  AnnouncementBar,
  AnySection,
  FooterNewsletter,
  HomeSection,
  HomeSectionType,
  LayoutDocument,
  LayoutGroup,
} from "@/features/storefront/api/layout"

/** The groups in the order the storefront draws them. */
export const LAYOUT_GROUPS: readonly LayoutGroup[] = ["header", "home", "footer"]

/** The home page's section types, in the order the chooser offers them. */
export const HOME_TYPES: readonly HomeSectionType[] = [
  "hero",
  "banner",
  "categories",
  "products",
  "brands",
  "posts",
  "reviews",
  "rich_text",
  "trust_badges",
  "newsletter",
  "help",
]

const ID_LENGTH = 12
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

/** A new section's id: 12 lowercase letters and digits, none the document holds already. */
export function newSectionId(taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
    const id = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("")
    if (!taken.has(id)) {
      return id
    }
  }
}

/** Every section of the document, top to bottom. */
export const allSections = (doc: LayoutDocument): AnySection[] => [
  ...doc.header,
  ...doc.home,
  ...doc.footer,
]

export const idsOf = (doc: LayoutDocument): Set<string> =>
  new Set(allSections(doc).map((section) => section.id))

/** A section by its id, with the group it sits in. */
export function findSection(
  doc: LayoutDocument,
  id: string
): { group: LayoutGroup; section: AnySection; index: number } | null {
  for (const group of LAYOUT_GROUPS) {
    const sections: readonly AnySection[] = doc[group]
    const index = sections.findIndex((section) => section.id === id)
    const section = sections[index]
    if (section) {
      return { group, section, index }
    }
  }
  return null
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null } as const

/** A section as the chooser adds it: the storefront's own words until the shop writes its own. */
export function newHomeSection(type: HomeSectionType, id: string): HomeSection {
  const base = { id, ...ALWAYS }
  switch (type) {
    case "hero":
      return { ...base, type, eyebrow: null, heading: null, text: null, links: [], image: null }
    case "banner":
      return { ...base, type, slides: [] }
    case "categories":
      return { ...base, type, title: null, category_ids: [] }
    case "products":
      return {
        ...base,
        type,
        title: null,
        source: { kind: "newest" },
        limit: 12,
        more: { kind: "system", target: "shop", label: null },
      }
    case "brands":
      return { ...base, type, title: null, brand_ids: [] }
    case "posts":
      return { ...base, type, title: null, limit: 3 }
    case "reviews":
      return { ...base, type, title: null, limit: 6 }
    case "rich_text":
      return { ...base, type, title: null, body: { type: "doc", content: [] } }
    case "trust_badges":
      return { ...base, type }
    case "newsletter":
    case "help":
      return { ...base, type, title: null, text: null }
  }
}

/** The announcement bar, with one line to write. */
export const newAnnouncementBar = (id: string): AnnouncementBar => ({
  id,
  ...ALWAYS,
  type: "announcement_bar",
  lines: [""],
})

/** The footer's newsletter box, in the storefront's own words. */
export const newFooterNewsletter = (id: string): FooterNewsletter => ({
  id,
  ...ALWAYS,
  type: "newsletter",
  title: null,
  text: null,
})

/** A copy under a new id, placed right after the section. */
export function copyOf<T extends AnySection>(section: T, id: string): T {
  return { ...structuredClone(section), id }
}

/** Shown only from or until a moment. */
export const isScheduled = (section: AnySection): boolean =>
  section.starts_at !== null || section.ends_at !== null

/** A text field's value as the document keeps it: nothing written is none. */
export const textOrNull = (value: string): string | null => (value.trim() === "" ? null : value)

/** The document as the server takes it: the same text means the same document. */
export const sameDocument = (a: LayoutDocument, b: LayoutDocument): boolean =>
  JSON.stringify(a) === JSON.stringify(b)
