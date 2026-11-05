import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"

const PROSE =
  "flex max-w-[65ch] flex-col gap-4 text-md leading-[1.7] text-text-2 lg:text-lg [&_a]:py-3 [&_a]:font-semibold [&_a]:text-text [&_a]:underline [&_h3]:mt-4 [&_h3]:text-title [&_h3]:text-text [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-text [&_ul]:list-disc"

/**
 * The shop's own text (`rich_text`: its story, "Neden biz?"): the heading
 * large on the left, the text in a reading measure on the right, on the
 * tinted well. The HTML is the backend's, from its allow-listed schema
 * (adr/0019); without the shop's text the section is not on the page.
 * Its links take 12 px above and below as touch room (inline padding: the
 * lines do not move), so a link on its own line is a 44 px target.
 */
export function Story({ section }: { section: Of<"rich_text"> }) {
  const id = headingId(section.id)
  return (
    <section {...(section.title ? { "aria-labelledby": id } : {})} className="pt-(--section-gap)">
      <Container>
        <div className="grid gap-6 rounded-tile bg-paper-2 p-6 sm:p-10 lg:grid-cols-12 lg:gap-(--gap-columns) lg:p-16">
          {section.title && (
            <h2 id={id} className="lg:col-span-5">
              {section.title}
            </h2>
          )}
          <div
            className={`${PROSE} ${section.title ? "lg:col-span-7" : "lg:col-span-8 lg:col-start-3"}`}
            // adr/0019: built by the backend from an allow-listed document schema
            dangerouslySetInnerHTML={{ __html: section.html }}
          />
        </div>
      </Container>
    </section>
  )
}
