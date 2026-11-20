/**
 * Which mounted cart sheet answers a `qt:cart-added` event: exactly one,
 * at every width. A header may hold one cart a screen width (the
 * catalog's), and below a header's desktop width its carts may all be
 * hidden (the bottom bar's "Sepet" is a plain link); a line that went in
 * still opens one sheet. The first cart link shown answers; none shown,
 * the first mounted one does (its sheet needs no visible link to open).
 */
const mounted: HTMLElement[] = []

/** Counts a cart sheet's link in; the returned function counts it out. */
export function mountCartTrigger(trigger: HTMLElement): () => void {
  mounted.push(trigger)
  return () => {
    const at = mounted.indexOf(trigger)
    if (at !== -1) {
      mounted.splice(at, 1)
    }
  }
}

const shown = (element: HTMLElement) => element.getClientRects().length > 0

/** True when this cart link's sheet is the one to open for a line that went in. */
export function answersCartAdded(trigger: HTMLElement): boolean {
  const live = mounted.filter((element) => element.isConnected)
  const owner = live.find(shown) ?? live[0]
  return owner === trigger
}
