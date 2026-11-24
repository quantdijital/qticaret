import { Plus } from "lucide-react"
import type { FaqSettings } from "@qticaret/types"
import type { ContactView, FaqGroupView, FaqView, Translate } from "@qticaret/ui"
import { Reach } from "../sections/Help"
import { Prose } from "./Prose"

/** How the disclosures open: the page's first one open, all in one group (`name`); none: closed, each on its own. */
interface Opening {
  first: string | null
  name: string | undefined
}

const CLOSED: Opening = { first: null, name: undefined }

/** A group's questions as rounded disclosures, every answer in the HTML, closed unless the shop opens the first. */
function Questions({ group, opening }: { group: FaqGroupView; opening: Opening }) {
  return (
    <div className="flex flex-col gap-2">
      {group.items.map((item, index) => (
        <details
          key={item.question}
          name={opening.name}
          open={opening.first === group.id && index === 0 ? true : undefined}
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
export function FaqBody({
  faq,
  help,
  t,
  suffix = "",
  settings,
  sectionId,
}: {
  faq: FaqView
  help: ContactView | null
  t: Translate
  /** Added to its ids when another text of questions on the page has them (`idSuffixes`). */
  suffix?: string
  /** An FAQ section's switches (adr/0073 Ek 2026-11-24 (2)); none: closed, each on its own. */
  settings?: FaqSettings | undefined
  /** The section's id, naming its disclosures' group when one opens at a time. */
  sectionId?: string | undefined
}) {
  const titled = faq.groups.filter((each) => each.title !== null)
  // Native, no script: the first question open, one open at a time by the disclosures' shared name
  const opening: Opening = settings
    ? {
        first: settings.open_first === "on" ? (faq.groups[0]?.id ?? null) : null,
        name: settings.single_open === "on" && sectionId ? `sss-${sectionId}` : undefined,
      }
    : CLOSED
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
      <aside className="max-lg:contents lg:col-span-4">
        <div className="max-lg:contents lg:sticky lg:top-(--gf-stick-top) lg:flex lg:flex-col lg:gap-8">
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
              aria-labelledby={`yardim${suffix}`}
              className="flex flex-col gap-4 rounded-tile border border-rule p-6 max-lg:order-3"
            >
              <h2 id={`yardim${suffix}`} className="text-title">
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
              <Questions group={group} opening={opening} />
            </section>
          ) : (
            <div key={group.id} className="flex flex-col gap-5">
              <Prose html={group.lead} className="gf-prose--small" />
              <Questions group={group} opening={opening} />
            </div>
          )
        )}
      </div>
    </div>
  )
}
