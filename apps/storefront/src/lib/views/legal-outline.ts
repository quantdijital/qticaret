import type { OutlineItemView } from "@qticaret/ui"

/**
 * A legal text's table of contents (D10): every `h2` of the backend's HTML
 * (adr/0019) gets an id made from its words, so the page can list and link
 * them. Only the opening tag changes; the text stays the backend's.
 */

const H2 = /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g
const ID = /\sid="([^"]*)"/

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

/** The heading's words as a reader sees them: tags dropped, entities read. */
export function wordsOf(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
      }
      if (name.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
      }
      return ENTITIES[name.toLowerCase()] ?? whole
    })
    .replace(/\s+/g, " ")
    .trim()
}

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }

/** "7. Cayma Hakkı" → "7-cayma-hakki": letters and digits only, the Turkish ones folded. */
export function anchorOf(words: string): string {
  return words
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (letter) => FOLD[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
}

export function withOutline(html: string): { html: string; outline: OutlineItemView[] } {
  const outline: OutlineItemView[] = []
  const taken = new Set<string>()
  const anchored = html.replace(H2, (whole, attributes: string | undefined, inner: string) => {
    const label = wordsOf(inner)
    if (!label) {
      return whole
    }
    const own = attributes ? ID.exec(attributes)?.[1] : undefined
    if (own) {
      taken.add(own)
      outline.push({ id: own, label })
      return whole
    }
    const base = anchorOf(label) || `bolum-${String(outline.length + 1)}`
    let id = base
    for (let n = 2; taken.has(id); n++) {
      id = `${base}-${String(n)}`
    }
    taken.add(id)
    outline.push({ id, label })
    return `<h2 id="${id}"${attributes ?? ""}>${inner}</h2>`
  })
  return { html: anchored, outline }
}
