import { Mail } from "lucide-react"
import { fieldMark } from "@qticaret/ui"
import type { NewsletterLookView, PlaceOrderResult } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { BandPicture } from "../sections/BandPicture"
import { NewsletterForm } from "./NewsletterForm"
import type { NewsletterWords } from "./newsletter-words"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

/** The newsletter variants after `standard` (adr/0049 Ek 2026-11-17 e-bülten). */
export type JoinedVariant = Exclude<NewsletterLookView["variant"], "standard">

export interface NewsletterBoxProps {
  variant: JoinedVariant
  look: NewsletterLookView
  title: string
  /** The heading's id: the box's region is labelled by it. */
  headingId: string
  formId: string
  words: NewsletterWords
  privacyPath: string | null
  subscribe: Subscribe
  /** The theme editor's live preview: the words carry their field marks. */
  marks: boolean
  /** `page`: a box on the page's ground (`gf-pane`, `tint`: `gf-news-tint`); `footer`: on the footer's own ground. */
  place: "page" | "footer"
  /** The editor's section mark (or none) for the region. */
  sectionMark?: { "data-qs"?: string }
}

/** The heading, the line and the promise, each only when it has words. */
function Words({
  look,
  title,
  headingId,
  marks,
  small,
}: {
  look: NewsletterLookView
  title: string
  headingId: string
  marks: boolean
  small: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h2
        id={headingId}
        className={small ? "text-sm font-semibold" : "text-title"}
        {...fieldMark(marks, "title")}
      >
        {title}
      </h2>
      {look.description && (
        <p
          className={cn("max-w-[52ch] text-text-2", small ? "text-xs" : "text-sm")}
          {...fieldMark(marks, "description")}
        >
          {look.description}
        </p>
      )}
      {look.note && (
        <p className="text-xs font-semibold text-text-2" {...fieldMark(marks, "note")}>
          {look.note}
        </p>
      )}
    </div>
  )
}

/**
 * The newsletter box drawn one of the new ways, on a page or in the
 * footer, the sending and the consent as today's (`NewsletterForm`
 * `joined quiet`): `split` a low band, the words left and the joined form
 * right; `image_card` the picture beside them (none: `split`); `strip`
 * one thin row, an envelope, the heading and the line, the small form at
 * its end; `in_footer` a small block for the footer's brand column. On a
 * phone each stacks: words, then the form, full width.
 */
export function NewsletterBox(props: NewsletterBoxProps) {
  const { look, title, headingId, formId, words, privacyPath, subscribe, marks, place } = props
  const variant = props.variant === "image_card" && !look.image ? "split" : props.variant
  const boxed = place === "page"
  // The box's ground: the theme's pane, or the wash of the shop's main colour (`tone`)
  const pane = look.tone === "tint" ? "rounded-tile gf-news-tint" : "rounded-tile gf-pane"
  const form = (className = "") => (
    <NewsletterForm
      id={formId}
      joined
      quiet
      action={subscribe}
      privacyPath={privacyPath}
      words={words}
      marks={marks}
      className={className}
    />
  )
  const region = {
    "aria-labelledby": headingId,
    "data-news": variant,
    ...props.sectionMark,
  }
  if (variant === "in_footer") {
    return (
      <section {...region} className="flex flex-col gap-3">
        <Words look={look} title={title} headingId={headingId} marks={marks} small />
        {form()}
      </section>
    )
  }
  if (variant === "strip") {
    return (
      <section
        {...region}
        className={cn(
          "flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-(--gap-columns)",
          boxed ? `${pane} px-5 py-4 sm:px-6` : "py-2"
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 lg:items-center">
          <Mail className="mt-0.5 size-5 shrink-0 lg:mt-0" aria-hidden="true" strokeWidth={1.75} />
          <div className="flex min-w-0 flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-3">
            <h2
              id={headingId}
              className="text-md font-semibold lg:shrink-0"
              {...fieldMark(marks, "title")}
            >
              {title}
            </h2>
            {look.description && (
              <p className="text-sm text-text-2" {...fieldMark(marks, "description")}>
                {look.description}
              </p>
            )}
          </div>
        </div>
        {form("gf-news-small gf-join-box w-full lg:w-[24rem] lg:shrink-0")}
      </section>
    )
  }
  if (variant === "image_card" && look.image) {
    return (
      <section
        {...region}
        className={cn(
          "grid overflow-hidden lg:grid-cols-12",
          boxed ? pane : "gap-6 lg:gap-x-(--gap-columns)"
        )}
      >
        <div
          className={cn(
            "relative isolate aspect-[16/9] bg-media lg:col-span-5 lg:aspect-auto lg:min-h-64",
            !boxed && "overflow-hidden rounded-tile"
          )}
        >
          <BandPicture
            image={look.image}
            phone={null}
            sizes="(min-width: 64rem) 40vw, 100vw"
            eager={false}
            mark={fieldMark(marks, "image")}
          />
        </div>
        <div
          className={cn(
            "flex flex-col justify-center gap-5 lg:col-span-7",
            boxed && "p-6 sm:p-8 lg:px-12 lg:py-10"
          )}
        >
          <Words look={look} title={title} headingId={headingId} marks={marks} small={false} />
          {form("max-w-[32rem]")}
        </div>
      </section>
    )
  }
  return (
    <section
      {...region}
      className={cn(
        "grid gap-5 lg:grid-cols-12 lg:items-center lg:gap-x-(--gap-columns)",
        boxed && `${pane} p-6 sm:px-8 sm:py-7 lg:px-10`
      )}
    >
      <div className="lg:col-span-6">
        <Words look={look} title={title} headingId={headingId} marks={marks} small={false} />
      </div>
      {form("lg:col-span-5 lg:col-start-8")}
    </section>
  )
}
