/**
 * The content pages just made on the Sayfalar list, on their way to the
 * theme editor, which gives them an empty page text once. Kept here, in
 * this tab's memory, not in the address: an address can be bookmarked or
 * written by hand, and must not empty an existing page's text.
 */
const justMade = new Set<string>()

/** A page just made: the editor it is opened in adds its empty text. */
export function markJustMade(id: string): void {
  justMade.add(id)
}

/** Whether the page was just made here and its text not yet added. */
export function isJustMade(id: string): boolean {
  return justMade.has(id)
}

/** The page's empty text added (or found not to be wanted): not again. */
export function forgetJustMade(id: string): void {
  justMade.delete(id)
}
