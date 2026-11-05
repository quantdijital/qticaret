import type { ProductPageView, SpecGroupView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { InfoTabs } from "./InfoTabs"
import { ReadMore } from "./ReadMore"
import { infoWords } from "./words"

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

/** The description's length past which it opens closed: about half a phone's screen of text. */
const LONG = 700

const lengthOf = (view: ProductPageView) =>
  view.descriptionHtml !== null
    ? view.descriptionHtml.replace(/<[^>]*>/g, "").length
    : view.description.join(" ").length

/**
 * The specs as one real table, ruled: each of the template's groups a
 * `<tbody>` headed by its name (a heavy row over a dark rule), each row
 * the label on the left and the value on the right, a hairline between
 * rows; without groups one flat body.
 */
function Specs({ groups }: { groups: SpecGroupView[] }) {
  return (
    <table className="w-full max-w-3xl border-collapse text-sm">
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
  )
}

/**
 * The product's description and its specs right under the buy area, every
 * word in the first HTML (docs/19 §6.5): one block of two tabs (sahip
 * 2026-11-05), "Ürün açıklaması" first, opening at about half when long,
 * then "Ürün özellikleri", the ruled table. The description is its
 * content document as the backend renders it (adr/0055, its allow-listed
 * HTML, its own spec table kept inside as the shop wrote it), else its
 * plain paragraphs. With only one of the two there are no tabs: that one
 * under its own heading.
 */
export function Details({ view, t }: { view: ProductPageView; t: Translate }) {
  const groups = groupsOf(view)
  const described = view.descriptionHtml !== null || view.description.length > 0
  if (!described && groups.length === 0) {
    return null
  }
  const words = infoWords(t)
  const description = described ? (
    <ReadMore id="aciklama-metni" long={lengthOf(view) > LONG} more={words.more} less={words.less}>
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
    </ReadMore>
  ) : null
  const specs = groups.length > 0 ? <Specs groups={groups} /> : null
  if (description && specs) {
    return (
      <InfoTabs
        label={words.tabs}
        tabs={[
          {
            id: "aciklama",
            headingId: "urun-aciklamasi",
            title: words.description,
            content: description,
          },
          { id: "ozellikler", headingId: "urun-ozellikleri", title: words.specs, content: specs },
        ]}
      />
    )
  }
  const [heading, title] = description
    ? ["urun-aciklamasi", words.description]
    : ["urun-ozellikleri", words.specs]
  return (
    <section aria-labelledby={heading} className="flex min-w-0 flex-col gap-5">
      <h2 id={heading} className="text-section">
        {title}
      </h2>
      {description ?? specs}
    </section>
  )
}
