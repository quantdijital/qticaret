const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
}

/**
 * A description as plain paragraphs: line and paragraph breaks kept, every
 * other tag dropped, a few entities read. Themes print text, never HTML
 * from the catalog (React escapes it); rich content pages come as their
 * own sanitised HTML (adr/0019).
 */
export function paragraphsOf(text: string | null | undefined): string[] {
  return (text ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<\/?[a-z][^<>]*>/gi, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .split(/\n\s*\n+/)
    .map((paragraph) =>
      paragraph
        .replace(/[ \t]+/g, " ")
        .replace(/\s*\n\s*/g, " ")
        .trim()
    )
    .filter((paragraph) => paragraph !== "")
}

/** An absolute URL as a path on our own site ("https://x/urun/a?b" → "/urun/a?b"). */
export function pathOf(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url.startsWith("/") ? url : `/${url}`
  }
}
