import type { ProductPageView, SpecGroupView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** The description's own type: a reading measure, its headings a step above the body. */
const PROSE = [
  "flex max-w-[68ch] min-w-0 flex-col gap-4 text-md leading-[1.75] text-text-2 lg:text-[1.0625rem]",
  "[&_h2]:mt-8 [&_h2]:max-w-none [&_h2]:text-title [&_h2]:leading-snug [&_h2]:text-text [&_h2:first-child]:mt-0",
  "[&_h3]:mt-4 [&_h3]:text-md [&_h3]:text-text [&_h4]:font-semibold [&_h4]:text-text",
  "[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_li]:pl-1 [&_li::marker]:text-text-3",
  "[&_strong]:font-semibold [&_strong]:text-text [&_a]:font-semibold [&_a]:text-text [&_a]:underline [&_a]:underline-offset-4",
  "[&_blockquote]:rounded-media [&_blockquote]:bg-paper-2 [&_blockquote]:p-4",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border-b [&_td]:border-rule [&_td]:py-2 [&_td]:pr-3 [&_th]:border-b [&_th]:border-rule [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text [&_b]:font-semibold",
].join(" ")

/** The spec table's sections: the template's groups, else one untitled group of every spec. */
const groupsOf = (view: ProductPageView): SpecGroupView[] =>
  view.specGroups && view.specGroups.length > 0
    ? view.specGroups
    : view.specs.length > 0
      ? [{ title: null, rows: view.specs }]
      : []

/**
 * The specs as one real table, ruled: each of the template's groups a
 * `<tbody>` headed by its name (a heavy row over a dark rule), each row
 * the label on the left and the value on the right, a hairline between
 * rows; without groups one flat body.
 */
function Specs({ groups, title }: { groups: SpecGroupView[]; title: string }) {
  return (
    <section aria-labelledby="urun-ozellikleri" className="flex min-w-0 flex-col gap-5">
      <h2 id="urun-ozellikleri" className="text-section">
        {title}
      </h2>
      <table className="w-full border-collapse text-sm">
        {groups.map((group, index) => (
          <tbody key={group.title ?? `grup-${String(index)}`}>
            {group.title !== null && (
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={2}
                  className={cn(
                    "border-b-2 border-text pb-2 text-left text-md font-extrabold tracking-[-0.01em]",
                    index > 0 ? "pt-8" : "pt-0"
                  )}
                >
                  {group.title}
                </th>
              </tr>
            )}
            {group.rows.map((spec) => (
              <tr key={spec.label} className="border-b border-rule">
                <th
                  scope="row"
                  className="w-2/5 py-3 pr-4 text-left align-top font-normal text-text-2"
                >
                  {spec.label}
                </th>
                <td className="tabular py-3 align-top font-semibold">{spec.value}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </section>
  )
}

/**
 * The product's description and its specs, every word in the first HTML
 * (docs/19 §6.5): the description's content document as the backend
 * renders it (adr/0055, its allow-listed HTML), else its plain
 * paragraphs, in a reading column; the spec table beside it from 1024 px.
 */
export function Details({ view, t }: { view: ProductPageView; t: Translate }) {
  const groups = groupsOf(view)
  const described = view.descriptionHtml !== null || view.description.length > 0
  if (!described && groups.length === 0) {
    return null
  }
  return (
    <div className="grid gap-(--space-2xl) lg:grid-cols-12 lg:gap-(--gap-columns)">
      {described && (
        <section
          aria-labelledby="urun-aciklamasi"
          className={cn(
            "flex min-w-0 flex-col gap-5",
            groups.length > 0 ? "lg:col-span-7" : "lg:col-span-8"
          )}
        >
          <h2 id="urun-aciklamasi" className="text-section">
            {t("product.description")}
          </h2>
          {view.descriptionHtml !== null ? (
            <div
              className={PROSE}
              // adr/0019, adr/0055: built by the backend from an allow-listed document schema
              dangerouslySetInnerHTML={{ __html: view.descriptionHtml }}
            />
          ) : (
            <div className={PROSE}>
              {view.description.map((paragraph, index) => (
                <p key={String(index)}>{paragraph}</p>
              ))}
            </div>
          )}
        </section>
      )}
      {groups.length > 0 && (
        <div className={described ? "lg:col-span-5 lg:col-start-8" : "lg:col-span-8"}>
          <Specs groups={groups} title={t("product.specs")} />
        </div>
      )}
    </div>
  )
}
