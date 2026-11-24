import { fieldMark } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { SearchForm } from "../parts/SearchForm"
import { type Of, headingId } from "./plan"

/**
 * The search box section (`search_box`, adr/0077 §1): an optional heading
 * and intro, then the shop's one search box at the content width. With no
 * heading the section takes the form's own name. Its ground and alignment
 * are the section's look (`Look`); the box stays a white panel on any
 * ground.
 */
export function SearchBoxSection({ section }: { section: Of<"search_box"> }) {
  const id = headingId(section.id)
  const named = section.title !== null
  return (
    <section
      aria-labelledby={named ? id : undefined}
      aria-label={named ? undefined : section.form.label}
      className="gf-section"
    >
      <Container className="flex flex-col gap-(--head-gap)">
        {(named || section.intro) && (
          <div className="flex max-w-2xl flex-col gap-2 group-data-[align=center]/look:mx-auto group-data-[align=center]/look:items-center group-data-[align=center]/look:text-center">
            {named && (
              <h2 id={id} {...fieldMark(section.editor, "title")}>
                {section.title}
              </h2>
            )}
            {section.intro && (
              <p className="text-text-2" {...fieldMark(section.editor, "intro")}>
                {section.intro}
              </p>
            )}
          </div>
        )}
        {section.hint ? (
          // While the shop reads sentences: what may be written there (adr/0077 §7)
          <div className="flex flex-col gap-2">
            <SearchForm form={section.form} />
            <p className="text-sm text-text-2">{section.hint}</p>
          </div>
        ) : (
          <SearchForm form={section.form} />
        )}
      </Container>
    </section>
  )
}
