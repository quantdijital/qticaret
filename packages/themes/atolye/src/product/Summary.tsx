import type { Translate } from "@qticaret/ui"
import { PROSE_INLINE, PROSE_LISTS } from "./prose"
import { ReadMore } from "./ReadMore"
import { infoWords } from "./words"

/** The short description's own type: the body's size, small headings, the description's lists. */
const SUMMARY_PROSE = [
  "flex max-w-[60ch] min-w-0 flex-col gap-3 text-md leading-[1.7] text-text-2",
  "[&_h3]:text-md [&_h3]:font-semibold [&_h3]:text-text [&_h4]:text-md [&_h4]:font-semibold [&_h4]:text-text",
  PROSE_LISTS,
  PROSE_INLINE,
].join(" ")

/** About six lines of it (1rem at 1.7): a phone shows this much before "Devamını oku". */
const PHONE_LIMIT = 140
/** Its length past which a phone opens it closed: about six lines of a phone's width. */
const LONG = 320

/**
 * The shop's short description under the name and stars, above the price
 * (adr/0055 Ek 2026-11-06), as the shop wrote it: the backend's HTML of
 * its document (adr/0019, the description's allow-list), in the body's
 * size, no card. A long one closes on a phone at about six lines with the
 * description's own "Devamını oku"; beside the gallery it shows whole.
 */
export function Summary({ html, t }: { html: string; t: Translate }) {
  const words = infoWords(t)
  return (
    <div className="pt-1">
      <ReadMore
        id="kisa-aciklama"
        long={html.replace(/<[^>]*>/g, "").length > LONG}
        more={words.more}
        less={words.less}
        limit={PHONE_LIMIT}
        phoneOnly
      >
        <div
          className={SUMMARY_PROSE}
          // adr/0019, adr/0055: built by the backend from an allow-listed document schema
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ReadMore>
    </div>
  )
}
