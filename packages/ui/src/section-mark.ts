/**
 * The section mark (adr/0049 Ek 2026-11-14 §8, adr/0065 §4): every section
 * a page shows, the header, the footer and a page's main section included,
 * resolves to exactly one element carrying `data-qs="<section id>"`. The
 * theme editor finds a section by it (to scroll to it and flash it), and
 * the shop's own CSS is scoped to it (E8). The contract a theme keeps:
 *
 * - the marked element is a real box (never `display: contents`), so it
 *   has a size and can be scrolled to;
 * - a section drawn inside another (a rail in a tabbed shelf, the help
 *   beside the FAQ) carries its own mark on its own element;
 * - a section with no look set still gets its box;
 * - the type and name never go into the page: the panel knows them.
 *
 * Live pages carry the mark too (adr/0065 karar 4): it means nothing to a
 * reader or a search engine. Everything editor-only stays in the preview.
 */
export const SECTION_MARK = "data-qs"

/** The attribute to spread on a section's element; none for a section without an id. */
export function sectionMark(id: string | null | undefined): { "data-qs"?: string } {
  return id ? { "data-qs": id } : {}
}
