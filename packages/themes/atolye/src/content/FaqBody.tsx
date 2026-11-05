import { Plus } from "lucide-react"
import type { ContentPageView, FaqGroupView, FaqView, Translate } from "@qticaret/ui"
import { Reach } from "../sections/Help"
import { Prose } from "./Prose"

/** A group's questions as rounded disclosures, every answer in the HTML, closed. */
function Questions({ group }: { group: FaqGroupView }) {
  return (
    <div className="flex flex-col gap-2">
      {group.items.map((item) => (
        <details key={item.question} className="group rounded-media bg-paper-2">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-media px-5 py-3 text-md font-semibold hover:bg-paper-3">
            {item.question}
            <Plus
              className="size-5 shrink-0 group-open:rotate-45 motion-safe:transition-transform"
              aria-hidden="true"
              strokeWidth={1.75}
            />
          </summary>
          <Prose html={item.html} className="gf-prose--small px-5 pb-5" />
        </details>
      ))}
    </div>
  )
}

/**
 * A text of questions and answers (the shop's FAQ), read into its groups:
 * from 1024 px the topics and the ways to reach the shop stay in a column
 * on the left while the groups scroll on the right; on a phone the topics
 * are a row of pills above, the help closes the page. Each group's
 * questions are rounded disclosures (the home page's), closed.
 */
export function FaqBody({ view, faq, t }: { view: ContentPageView; faq: FaqView; t: Translate }) {
  const titled = faq.groups.filter((group) => group.title !== null)
  const help = view.help ?? null
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
      <aside className="max-lg:contents lg:col-span-4">
        <div className="max-lg:contents lg:sticky lg:top-40 lg:flex lg:flex-col lg:gap-8">
          {titled.length >= 2 && (
            <nav aria-label={t("content.faq_topics")} className="min-w-0 max-lg:order-1">
              <ul className="gf-rail -mx-(--gutter) flex scroll-px-(--gutter) gap-2 overflow-x-auto px-(--gutter) py-1 lg:scroll-px-0 lg:mx-0 lg:flex-col lg:items-start lg:overflow-visible lg:px-0">
                {titled.map((group) => (
                  <li key={group.id} className="shrink-0">
                    <a href={`#${group.id}`} className="gf-chip">
                      {group.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {help && (
            <section
              aria-labelledby="yardim"
              className="flex flex-col gap-4 rounded-tile border border-rule p-6 max-lg:order-3"
            >
              <h2 id="yardim" className="text-title">
                {t("content.help_title")}
              </h2>
              <p className="text-text-2">{t("content.help_text")}</p>
              <Reach contact={help} t={t} className="lg:flex-col lg:flex-nowrap" />
            </section>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-12 max-lg:order-2 lg:col-span-8 lg:col-start-5">
        <Prose html={faq.intro} />
        {faq.groups.map((group) =>
          group.title ? (
            <section key={group.id} aria-labelledby={group.id} className="flex flex-col gap-5">
              <h2
                id={group.id}
                className="scroll-mt-40 text-[calc(var(--text-title)*1.2)] tracking-[-0.02em]"
              >
                {group.title}
              </h2>
              <Prose html={group.lead} className="gf-prose--small" />
              <Questions group={group} />
            </section>
          ) : (
            <div key={group.id} className="flex flex-col gap-5">
              <Prose html={group.lead} className="gf-prose--small" />
              <Questions group={group} />
            </div>
          )
        )}
      </div>
    </div>
  )
}
