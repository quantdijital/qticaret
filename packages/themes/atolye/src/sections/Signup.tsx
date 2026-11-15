import { fieldMark } from "@qticaret/ui"
import type { PlaceOrderResult, Translate } from "@qticaret/ui"
import { NewsletterForm } from "../frame/NewsletterForm"
import { newsletterWords } from "../frame/newsletter-words"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"

/**
 * A newsletter section the shop placed on its home page: its heading on
 * the tinted well, the form beside it with the shop's consent sentence as
 * the box's label (İYS, double opt-in).
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
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container>
        <div className="grid gap-6 rounded-tile gf-pane p-6 sm:p-10 lg:grid-cols-12 lg:items-end lg:gap-(--gap-columns) lg:p-14">
          <h2 id={id} className="lg:col-span-5" {...fieldMark(section.editor, "title")}>
            {section.title}
          </h2>
          <NewsletterForm
            id={`${id}-form`}
            action={subscribe}
            privacyPath={section.privacyPath}
            words={newsletterWords(t, section.text)}
            marks={section.editor}
            className="lg:col-span-6 lg:col-start-7"
          />
        </div>
      </Container>
    </section>
  )
}
