import { Mail, MessageCircle, Phone, Plus } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { PlaceOrderResult, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { TrustStrip } from "../components/TrustStrip"
import { NewsletterForm, newsletterWords } from "../layout/NewsletterForm"
import { headingId } from "./Opening"
import type { Of } from "./plan"

/** The shop's questions (adr/0049): native disclosures, every answer in the HTML (FAQPage data). */
export function FaqSection({ section, t }: { section: Of<"faq">; t: Translate }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
        <h2 id={id} className="lg:col-span-4">
          {section.title ?? t("faq.title")}
        </h2>
        <div className="border-t-2 border-rule-ink lg:col-span-8">
          {section.items.map((item, index) => (
            <details
              key={`${String(index)}-${item.question}`}
              className="group border-b border-rule"
            >
              <summary className="at-row-link flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {item.question}
                <Plus
                  className="size-5 shrink-0 group-open:rotate-45 motion-safe:transition-transform"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </summary>
              <p className="max-w-[65ch] pb-5 text-md whitespace-pre-line text-text-2">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  )
}

const HELP_ROW = "at-row-link flex min-h-14 items-center gap-3 py-3 text-lg font-medium"

/**
 * How to reach the shop, on a sand band: the WhatsApp chat, the phone and
 * the address it gave, as ruled rows under an ink rule (Loom's pattern
 * book), each row one link.
 */
export function HelpBand({ section, t }: { section: Of<"help">; t: Translate }) {
  const { contact } = section
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="mt-(--section-gap) bg-paper-2 py-(--section-gap-s)">
      <Container className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-(--gap-columns)">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <h2 id={id}>{section.title}</h2>
          <p className="lead max-w-[48ch] text-text-2">{section.text}</p>
        </div>
        <ul className="border-t-2 border-rule-ink lg:col-span-5 lg:col-start-8">
          {contact.whatsappHref && (
            <li className="border-b border-rule">
              <a href={contact.whatsappHref} target="_blank" rel="noopener" className={HELP_ROW}>
                <MessageCircle className="size-5" aria-hidden="true" strokeWidth={1.5} />
                {t("home.help_whatsapp")}
              </a>
            </li>
          )}
          {contact.phone && contact.phoneHref && (
            <li className="border-b border-rule">
              <a href={contact.phoneHref} className={`${HELP_ROW} tabular`}>
                <Phone className="size-5" aria-hidden="true" strokeWidth={1.5} />
                {contact.phone}
              </a>
            </li>
          )}
          {contact.email && (
            <li className="border-b border-rule">
              <a href={`mailto:${contact.email}`} className={`${HELP_ROW} break-all`}>
                <Mail className="size-5" aria-hidden="true" strokeWidth={1.5} />
                {contact.email}
              </a>
            </li>
          )}
        </ul>
      </Container>
    </section>
  )
}

/** The shop's own text (adr/0019's allow-listed HTML), one reading column. */
export function RichTextSection({ section }: { section: Of<"rich_text"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={section.title ? id : undefined} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-6">
        {section.title && <h2 id={id}>{section.title}</h2>}
        <div
          className="flex max-w-[65ch] flex-col gap-4 text-lg leading-[1.65] text-text-2 [&_a]:font-medium [&_a]:text-text [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-display [&_h2]:text-tile [&_h3]:text-title [&_h3]:font-medium [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-medium [&_strong]:text-text [&_ul]:list-disc"
          // adr/0019: built by the backend from an allow-listed document schema
          dangerouslySetInnerHTML={{ __html: section.html }}
        />
      </Container>
    </section>
  )
}

/** The shop's brands as a ruled index of names. */
export function BrandsSection({ section }: { section: Of<"brands"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-8">
        <h2 id={id}>{section.title}</h2>
        <ul className="grid grid-cols-2 gap-x-(--gap-columns) border-t-2 border-rule-ink md:grid-cols-4">
          {section.brands.map((brand) => (
            <li key={brand.path} className="border-b border-rule">
              <a
                href={brand.path}
                className="at-row-link flex min-h-11 items-center py-2 text-lg font-medium"
              >
                {brand.label}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/** The shop's promises as a ruled row (design.md § USP strip), wherever the shop placed it. */
export function TrustSection({ section, t }: { section: Of<"trust_badges">; t: Translate }) {
  return (
    <div className="pt-(--section-gap-s)">
      <Container>
        <TrustStrip badges={section.badges} label={t("footer.trust")} />
      </Container>
    </div>
  )
}

/** The newsletter box on the dark band, with its double opt-in line. */
export function NewsletterSection({
  section,
  t,
  subscribe,
}: {
  section: Of<"newsletter">
  t: Translate
  subscribe: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
}) {
  return (
    <div className="at-band mt-(--section-gap) bg-band py-(--section-gap-s) text-band-text">
      <Container className="max-w-(--container)">
        <div className="max-w-xl">
          <NewsletterForm
            id={headingId(section.id)}
            action={subscribe}
            privacyPath={section.privacyPath}
            words={newsletterWords(t, section.title, section.text)}
          />
        </div>
      </Container>
    </div>
  )
}

/**
 * The shop's pictures with a line and a link, side by side; a phone
 * scrolls them (a row that snaps, no script). A slide's link wraps it.
 */
export function BannerSection({ section, label }: { section: Of<"banner">; label: string }) {
  const focusable = section.slides.length > 1 && section.slides.every((slide) => !slide.link)
  return (
    <section aria-label={label} className="pt-(--section-gap)">
      <Container>
        <ul
          tabIndex={focusable ? 0 : undefined}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto md:grid md:auto-cols-fr md:grid-flow-col md:gap-(--gap-columns) md:overflow-visible"
        >
          {section.slides.map((slide, index) => {
            const body = (
              <figure className="flex flex-col gap-3">
                <div className="aspect-[4/3] overflow-hidden bg-paper-2">
                  <ResponsiveImage
                    image={slide.image}
                    sizes="(min-width: 768px) 33vw, 85vw"
                    className="h-full w-full object-cover"
                  />
                </div>
                {(slide.heading ?? slide.text) && (
                  <figcaption className="flex flex-col gap-1">
                    {slide.heading && (
                      <span className="text-title font-medium">{slide.heading}</span>
                    )}
                    {slide.text && <span className="text-md text-text-2">{slide.text}</span>}
                  </figcaption>
                )}
              </figure>
            )
            return (
              <li
                key={`${slide.image.src}-${String(index)}`}
                className="w-[85%] shrink-0 snap-start md:w-auto"
              >
                {slide.link ? (
                  <a
                    href={slide.link.path}
                    aria-label={slide.heading ?? slide.link.label}
                    className="at-tile block"
                  >
                    {body}
                  </a>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
