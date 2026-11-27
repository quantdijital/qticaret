import { drawnVariant, fieldMark } from "@qticaret/ui"
import type { PlaceOrderResult, Translate } from "@qticaret/ui"
import { NewsletterBox } from "../frame/NewsletterBox"
import { NewsletterForm } from "../frame/NewsletterForm"
import { newsletterWords } from "../frame/newsletter-words"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"

/** What a page's box draws besides today's (adr/0049 Ek 2026-11-17): the footer's column one is not. */
const ON_PAGE = ["standard", "split", "image_card", "strip"] as const

/**
 * A newsletter section the shop placed on its home page: its heading on
 * the tinted well, the form beside it with the shop's consent sentence as
 * the box's label (İYS, double opt-in). The variants after `standard`
 * (adr/0049 Ek 2026-11-17 e-bülten) are `NewsletterBox`'s; today's stays
 * drawn here as it was (the line beside the heading is the new
 * variants' only).
 */
export function Signup({
  section,
  t,
  subscribe,
}: {
  section: Of<"newsletter">
  t: Translate
  subscribe: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
}) {
  const id = headingId(section.id)
  const variant = drawnVariant("newsletter", section.variant, ON_PAGE)
  const words = newsletterWords(t, section.text, section.consentStyle)
  if (variant !== "standard") {
    return (
      <div className="gf-section">
        <Container>
          <NewsletterBox
            variant={variant}
            look={{
              variant,
              description: section.description ?? null,
              note: section.note ?? null,
              image: section.image ?? null,
              tone: section.tone ?? "plain",
              consentStyle: section.consentStyle ?? "box",
            }}
            title={section.title}
            headingId={id}
            formId={`${id}-form`}
            words={words}
            privacyPath={section.privacyPath}
            subscribe={subscribe}
            marks={Boolean(section.editor)}
            place="page"
          />
        </Container>
      </div>
    )
  }
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container>
        <div className="grid gap-6 rounded-tile gf-pane p-6 sm:p-10 lg:grid-cols-12 lg:items-end lg:gap-(--gap-columns) lg:p-14">
          <h2 id={id} className="lg:col-span-5" {...fieldMark(section.editor, "title")}>
            {section.title}
          </h2>
          <NewsletterForm
            id={`${id}-form`}
            action={subscribe}
            privacyPath={section.privacyPath}
            words={words}
            marks={section.editor}
            className="lg:col-span-6 lg:col-start-7"
          />
        </div>
      </Container>
    </section>
  )
}
