"use client"

declare global {
  interface Window {
    __webpack_nonce__?: string
  }
}

/**
 * Hands this response's CSP nonce to the style elements libraries make at
 * run time (docs/04, adr/0046 §4). Radix's dialogs lock the page's scroll
 * with `react-remove-scroll`, which writes a `<style>` element and gives it
 * the nonce it finds in `__webpack_nonce__` (through `get-nonce`); without
 * one the production policy (`style-src 'self' 'nonce-…'`) refuses the
 * element and the page behind the zoom, the cart drawer and every other
 * dialog keeps scrolling. Set while rendering, before any dialog can open;
 * the nonce is already in the page (its scripts carry it), so this shows it
 * to no one new.
 *
 * Only the first value counts: it is the document's, the one its policy
 * names. A server action or a refresh renders the layout again under a new
 * request's nonce, which this document's policy does not know.
 */
export function StyleNonce({ nonce }: { nonce: string | undefined }) {
  if (typeof window !== "undefined" && nonce && window.__webpack_nonce__ === undefined) {
    window.__webpack_nonce__ = nonce
  }
  return null
}
