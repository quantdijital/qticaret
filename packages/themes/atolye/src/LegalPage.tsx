import { ChevronDown } from "lucide-react"
import type { LegalPageView, OutlineItemView, Translate } from "@qticaret/ui"
import { readingGrid } from "./content/reading"
import { Container } from "./parts/Container"
import { Trail } from "./parts/Trail"

/** The legal text's own type: headings a step above the body, lists marked, the reading column's measure. */
const PROSE = [
  "flex max-w-[46rem] flex-col gap-4 text-md leading-[1.75] text-text-2 lg:text-[1.0625rem]",
  "[&_h2]:mt-10 [&_h2]:max-w-none [&_h2]:scroll-mt-40 [&_h2]:text-title [&_h2]:leading-snug [&_h2]:text-text [&_h2:first-child]:mt-0",
  "[&_h3]:mt-4 [&_h3]:text-md [&_h3]:text-text [&_h4]:font-semibold [&_h4]:text-text",
  "[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_li]:pl-1 [&_li::marker]:text-text-3",
  "[&_strong]:font-semibold [&_strong]:text-text [&_a]:font-semibold [&_a]:text-text [&_a]:underline [&_a]:underline-offset-4",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-4",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-rule [&_td]:p-2 [&_th]:border [&_th]:border-rule [&_th]:bg-paper-2 [&_th]:p-2 [&_th]:text-left",
].join(" ")

function Contents({ outline, linkClass }: { outline: OutlineItemView[]; linkClass: string }) {
  return (
    <ol className="flex flex-col">
      {outline.map((item) => (
        <li key={item.id}>
          <a href={`#${item.id}`} className={linkClass}>
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  )
}

/**
 * One of the shop's legal texts (`/yasal/{tür}`, adr/0041), made for
 * reading: the title and the date this version came into force, the
 * text in a reading measure with its headings a clear step above the
 * body, and its table of contents: on a phone a closed well above the
 * text, from 1024 px a list that stays beside it while it scrolls. The
 * shop's other published texts close the page. On a computer the text
 * stands in the posts' reading column (46rem, owner 2026-11-05: "aşırı
 * dar" at 56 letters), the contents on its left at the page's edge. The
 * HTML is the backend's, from its allow-listed schema (adr/0019).
 */
export function LegalPage({ view, t }: { view: LegalPageView; t: Translate }) {
  const contents = view.outline.length >= 2
  const reading = readingGrid({ outline: contents, tablet: false })
  return (
    <>
      <Container className="pt-6 lg:pt-10">
        <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
        <header className="mt-6 flex flex-col gap-3 lg:mt-10">
          <h1 className="max-w-[32ch]">{view.title}</h1>
          {view.updated && (
            <p className="text-sm text-text-3">
              {t("legal.updated")}{" "}
              <time dateTime={view.updated.dateTime} className="font-semibold text-text-2">
                {view.updated.label}
              </time>
            </p>
          )}
        </header>
      </Container>
      <Container className={`mt-8 grid gap-8 lg:mt-12 ${reading.grid}`}>
        {contents && (
          <>
            <details className="group rounded-tile gf-pane lg:hidden">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-5 font-semibold">
                <span>{t("legal.contents")}</span>
                <span className="flex items-center gap-2 text-sm font-normal text-text-3">
                  {t("legal.sections", { count: view.outline.length })}
                  <ChevronDown
                    className="size-5 transition-transform duration-(--dur-short) group-open:rotate-180"
                    aria-hidden="true"
                    strokeWidth={1.75}
                  />
                </span>
              </summary>
              <div className="px-2 pb-3">
                <Contents
                  outline={view.outline}
                  linkClass="flex min-h-11 items-center rounded-inner px-3 py-2 text-sm text-text-2 no-underline hover:bg-paper-3 hover:text-text"
                />
              </div>
            </details>
            <aside aria-labelledby="icindekiler" className={`max-lg:hidden ${reading.side}`}>
              <div className="sticky top-(--gf-stick-top) flex max-h-[calc(100dvh-var(--gf-stick-top)-1rem)] flex-col gap-3 overflow-y-auto pb-4">
                <h2 id="icindekiler" className="text-md text-text">
                  {t("legal.contents")}
                </h2>
                <Contents
                  outline={view.outline}
                  linkClass="block rounded-inner py-1.5 pr-3 pl-3 text-sm leading-snug text-text-2 no-underline hover:bg-paper-2 hover:text-text"
                />
              </div>
            </aside>
          </>
        )}
        <article className={`min-w-0 ${reading.column}`}>
          <div
            className={PROSE}
            // adr/0019: built by the backend from an allow-listed document schema
            dangerouslySetInnerHTML={{ __html: view.html }}
          />
          {view.others.length > 0 && (
            <section
              aria-labelledby="diger-metinler"
              className="mt-16 flex flex-col gap-4 rounded-tile gf-pane p-6 lg:p-8"
            >
              <h2 id="diger-metinler" className="text-title">
                {t("legal.others")}
              </h2>
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {view.others.map((link) => (
                  <li key={link.path}>
                    <a href={link.path} className="gf-link text-sm">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </Container>
    </>
  )
}
