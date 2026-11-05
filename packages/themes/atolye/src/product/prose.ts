/**
 * The product's texts as the backend renders them (adr/0055): the
 * description below the buy area and the short description above the
 * price set their lists, emphasis and links alike.
 */

/** Lists: discs and numbers, items apart, quiet markers. */
export const PROSE_LISTS =
  "[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_li]:pl-1 [&_li::marker]:text-text-3"

/** Bold in the text's ink, links bold and underlined. */
export const PROSE_INLINE =
  "[&_strong]:font-semibold [&_strong]:text-text [&_a]:font-semibold [&_a]:text-text [&_a]:underline [&_a]:underline-offset-4"
