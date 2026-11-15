import { Plus } from "lucide-react"
import { sectionMark } from "@qticaret/ui"
import type { Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Reach } from "./Help"
import { type Of, headingId } from "./plan"

/**
 * The shop's short FAQ: the head on the left from 1024 px, the questions
 * as rounded disclosures on the right, every answer in the HTML, closed
 * unless the shop opens the first; one open at a time if it asks.
 * A "help" section the shop placed right after it joins it under the
 * head: the ways to reach the shop, named by its heading for the reader,
 * for the question the list does not answer.
 */
export function Faq({
  section,
  help,
  t,
}: {
  section: Of<"faq">
  help?: Of<"help"> | null
  t: Translate
}) {
  const id = headingId(section.id)
  // The shop's switches (bilesen-denetimi (b) 8), native: no script. One open at a
  // time is the disclosures' shared `name` (an older browser opens each on its own).
  const openFirst = section.settings?.open_first === "on"
  const group = section.settings?.single_open === "on" ? `sss-${section.id}` : undefined
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="grid gap-6 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-(--gap-columns) lg:gap-y-8">
        <h2 id={id} className="lg:col-span-4">
          {section.title ?? t("faq.title")}
        </h2>
        <div className="flex flex-col gap-2 lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-1">
          {section.items.map((item, index) => (
            <details
              key={item.question}
              name={group}
              open={openFirst && index === 0 ? true : undefined}
              className="group rounded-media gf-pane"
            >
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-media px-5 py-3 text-md font-semibold hover:bg-paper-3">
                {item.question}
                <Plus
                  className="size-5 shrink-0 group-open:rotate-45 motion-safe:transition-transform"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
              </summary>
              <p className="max-w-[65ch] px-5 pb-5 text-text-2">{item.answer}</p>
            </details>
          ))}
        </div>
        {help && (
          <div
            className="flex flex-col gap-3 pt-4 lg:col-span-4 lg:row-start-2 lg:pt-0"
            {...sectionMark(help.id)}
          >
            <Reach
              contact={help.contact}
              t={t}
              label={help.title}
              className="lg:flex-col lg:items-start"
            />
          </div>
        )}
      </Container>
    </section>
  )
}
