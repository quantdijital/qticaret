import type { ListingTextView, Translate } from "@qticaret/ui"
import type { ListingTextSettings } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { PROSE_INLINE, PROSE_LISTS } from "../product/prose"
import { TextMore } from "./TextMore"

/**
 * The size on the theme's type scale (14 / 16 / 18 px), its leading with
 * it: set on the block, so the fold's six lines (`6lh`) are the text's own.
 */
export const LISTING_TEXT_SIZE: Readonly<Record<ListingTextSettings["size"], string>> = {
  sm: "text-sm leading-[1.7]",
  md: "text-md leading-[1.75]",
  lg: "text-lg leading-[1.7]",
}

/** Narrow: the content pages' reading measure (46rem); wide: the container's width. */
export const LISTING_TEXT_WIDTH: Readonly<Record<ListingTextSettings["width"], string>> = {
  narrow: "max-w-[46rem]",
  wide: "max-w-none",
}

/** Centred: the block in the middle, its lists and tables still read from the start. */
export const LISTING_TEXT_ALIGN: Readonly<Record<ListingTextSettings["align"], string>> = {
  start: "text-start",
  center:
    "mx-auto text-center [&_ol]:mx-auto [&_ol]:w-fit [&_ol]:text-start [&_table]:text-start [&_ul]:mx-auto [&_ul]:w-fit [&_ul]:text-start",
}

/**
 * The text's own type, the theme's body face: its headings (h2–h4, the
 * page's one h1 is the title) a step above it, sized from the text so
 * they follow the size; lists, emphasis and links as the product's.
 */
const PROSE = [
  "flex min-w-0 flex-col gap-4 text-text-2 [&_p]:max-w-none",
  "[&_h2]:mt-6 [&_h2]:text-[1.1875em] [&_h2]:leading-snug [&_h2]:font-semibold [&_h2]:text-text [&_h2:first-child]:mt-0",
  "[&_h3]:mt-4 [&_h3]:text-[1.0625em] [&_h3]:font-semibold [&_h3]:text-text [&_h3:first-child]:mt-0",
  "[&_h4]:font-semibold [&_h4]:text-text",
  PROSE_LISTS,
  PROSE_INLINE,
  "[&_blockquote]:rounded-media [&_blockquote]:bg-paper-2 [&_blockquote]:p-4",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.875em] [&_td]:border-b [&_td]:border-rule [&_td]:py-2 [&_td]:pr-3 [&_th]:border-b [&_th]:border-rule [&_th]:py-2 [&_th]:pr-3 [&_th]:text-start [&_th]:font-semibold [&_th]:text-text",
].join(" ")

/** About six lines at the narrow measure: past it the text opens folded (the client measures again). */
const LONG = 480

const lengthOf = (text: ListingTextView) =>
  text.html !== null ? text.html.replace(/<[^>]*>/g, "").length : text.paragraphs.join(" ").length

/**
 * A category, brand or collection page's own text at its foot (adr/0075
 * §5): after the products and their pages, before the category group's
 * bottom sections, so the products lead and the text is the last word
 * about them. Above it a hairline closes the list. The shop's look
 * (`look`) picks its size, alignment and measure; a long text folds to
 * six lines behind "Devamını oku" when the shop asks (`collapse`), every
 * word still in the HTML. A blog category's or tag's archive draws it the
 * same way at its foot (adr/0075 Ek 2026-11-24), inside the page's own
 * container (`bare`: no second one, so no second gutter).
 */
export function ListingText({
  text,
  t,
  bare = false,
}: {
  text: ListingTextView
  t: Translate
  /** Already in a container: the block alone, its rule as close as the page's gaps put it. */
  bare?: boolean
}) {
  const { look } = text
  const words =
    text.html !== null ? (
      <div
        className={PROSE}
        // adr/0019, adr/0075 §8: built by the backend from an allow-listed document schema
        dangerouslySetInnerHTML={{ __html: text.html }}
      />
    ) : (
      <div className={PROSE}>
        {text.paragraphs.map((paragraph, index) => (
          <p key={String(index)}>{paragraph}</p>
        ))}
      </div>
    )
  const block = (
    <div className="border-t border-rule pt-8 lg:pt-10">
      <div
        data-listing-text=""
        className={cn(
          "flex flex-col",
          LISTING_TEXT_SIZE[look.size],
          LISTING_TEXT_WIDTH[look.width],
          LISTING_TEXT_ALIGN[look.align]
        )}
      >
        {look.collapse ? (
          <TextMore
            id="liste-metni"
            long={lengthOf(text) > LONG}
            more={t("listing.text_more")}
            less={t("listing.text_less")}
            center={look.align === "center"}
          >
            {words}
          </TextMore>
        ) : (
          words
        )}
      </div>
    </div>
  )
  return bare ? (
    <div className="pt-4 lg:pt-6">{block}</div>
  ) : (
    <Container className="pt-12 lg:pt-16">{block}</Container>
  )
}
