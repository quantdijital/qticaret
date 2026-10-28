/**
 * Text that reads as a link or an address (`https://…`, `www.`, `a@b`,
 * `shop.com`): what a shopper typed is not repeated to others as one, nor
 * shown without the shop looking first (adr/0037 §4–5).
 */
const LINK_LIKE = /:\/\/|www\.|@|\b[\p{L}\d-]{2,}\.[a-z]{2,}\b/iu

export const readsAsLink = (text: string): boolean => LINK_LIKE.test(text)
