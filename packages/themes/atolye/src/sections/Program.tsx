import { fieldMark } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"
import { ProgramAccordion } from "./ProgramAccordion"
import { StepBody } from "./ProgramParts"

/**
 * A dated product's program (adr/0078) under its own block: `timeline`
 * the steps down a rule, each a dot beside its label and title, every
 * step open; `accordion` each step a row that opens. The head as the
 * other sections'. A product without steps has no section at all (the
 * storefront leaves it out), so nothing here draws an empty state.
 */
export function Program({ section }: { section: Of<"program"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-(--head-gap)">
        <h2 id={id} {...fieldMark(section.editor, "title")}>
          {section.title}
        </h2>
        <div className="w-full max-w-4xl">
          <ProgramSteps section={section} />
        </div>
      </Container>
    </section>
  )
}

/**
 * The program's steps as the shop chose to draw them, without a head:
 * under the section's own (`Program`) or a tab's beside the description
 * (`program.place: tab`).
 */
export function ProgramSteps({ section }: { section: Of<"program"> }) {
  return section.variant === "accordion" ? (
    <ProgramAccordion section={section} />
  ) : (
    <ol className="flex flex-col">
      {section.steps.map((step, index) => (
        <li
          key={`${String(index)}-${step.title}`}
          className="group/step relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0"
        >
          {/* The rule joining the dots; none below the last */}
          <span
            aria-hidden="true"
            className="absolute top-3 bottom-0 left-[0.6875rem] w-px bg-rule group-last/step:hidden"
          />
          <span
            aria-hidden="true"
            className="relative mt-1.5 size-6 rounded-full border-2 border-text bg-paper"
          />
          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-text-3">{step.label}</span>
              <span className="text-title font-semibold text-text">{step.title}</span>
            </h3>
            <StepBody step={step} />
          </div>
        </li>
      ))}
    </ol>
  )
}
