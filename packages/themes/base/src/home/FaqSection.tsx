import { ChevronDown } from "lucide-react"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { headingId } from "./SectionHead"

type Faq = Extract<HomeSectionView, { type: "faq" }>

/**
 * The shop's questions and answers (adr/0049): native disclosures, so they
 * open without a script and every answer stays in the HTML for readers,
 * crawlers and agents (docs/19 §6.5). No `FAQPage` data (docs/13 §5).
 */
export function FaqSection({ section, t }: { section: Faq; t: Translate }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h2 id={id} className="text-3xl leading-tight lg:text-4xl">
        {section.title ?? t("faq.title")}
      </h2>
      <div className="divide-y rounded-2xl border bg-card">
        {section.items.map((item, index) => (
          <details key={`${String(index)}-${item.question}`} className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <p className="px-5 pb-5 leading-relaxed whitespace-pre-line text-foreground/85">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
