import { PROSE_INLINE, PROSE_LISTS } from "./prose"

/** The short description's own type: the body's size, small headings, the description's lists. */
const SUMMARY_PROSE = [
  "flex max-w-[60ch] min-w-0 flex-col gap-3 text-md leading-[1.7] text-text-2",
  "[&_h3]:text-md [&_h3]:font-semibold [&_h3]:text-text [&_h4]:text-md [&_h4]:font-semibold [&_h4]:text-text",
  PROSE_LISTS,
  PROSE_INLINE,
].join(" ")

/**
 * The shop's short description under the price group (price, saving,
 * instalments, stock) and above the options (adr/0055 Ek 2026-11-06;
 * sahip 2026-11-06: the price block "kısa açıklamanın üstünde olsun"), with
 * the buy column's own gap either side, as the shop wrote it: the backend's HTML of
 * its document (adr/0019, the description's allow-list), in the body's
 * size, no card. Always whole, at every width (sahip 2026-11-06: no
 * "Devamını oku" under it on a phone).
 */
export function Summary({ html }: { html: string }) {
  return (
    <div
      className={SUMMARY_PROSE}
      // adr/0019, adr/0055: built by the backend from an allow-listed document schema
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
