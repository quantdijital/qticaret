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

/** A number and its unit stay on one line ("22 cm", "58-59 HRC"): the space after a digit never breaks. */
const keptTogether = (value: string) => value.trim().replace(/(\d)\s+(?=\S)/g, "$1\u00a0")

/**
 * One group of specs as its own table: the group's name a small bold
 * caption in sentence case with room above it, then the rows on hairlines, the
 * label muted in two fifths of the width, the value in regular weight; a
 * long value wraps in its own column. Without a name, no caption. Never
 * split between two columns.
 */
function SpecTable({ group }: { group: SpecGroupView }) {
  const rows = group.rows.filter((spec) => spec.value.trim() !== "")
  if (rows.length === 0) {
    return null
  }
  return (
    <div className="break-inside-avoid">
      <table className="w-full table-fixed border-collapse text-sm">
        {group.title !== null && (
          <caption className="pt-5 pb-1 text-left text-sm font-bold text-text">
            {group.title}
          </caption>
        )}
        <tbody>
          {rows.map((spec) => (
            <tr key={spec.label} className="border-t border-rule first:border-t-0">
              <th
                scope="row"
                className="w-2/5 py-3 pr-4 text-left align-top font-normal text-text-2"
              >
                {spec.label}
              </th>
              <td className="tabular py-3 align-top [overflow-wrap:anywhere] text-text">
                {keptTogether(spec.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The specs (owner 2026-11-05: "the specs look very rough, make them a
 * refined table"): one soft `paper-2` tile, a table per group in it; one
 * or two groups in a 48rem tile, from 1024 px three or more flow into two
 * balanced columns with a hairline between them, the tile's edge one
 * clean rectangle. On a phone the groups stack.
 */
function Specs({ groups }: { groups: SpecGroupView[] }) {
  const shown = groups.filter((group) => group.rows.some((spec) => spec.value.trim() !== ""))
  return (
    <div
      className={cn(
        "rounded-tile bg-paper-2 px-5 pt-1 pb-3 sm:px-6",
        shown.length >= 3
          ? "lg:columns-2 lg:gap-12 lg:[column-rule:1px_solid_var(--color-rule)]"
          : "max-w-3xl"
      )}
    >
      {shown.map((group, index) => (
        <SpecTable key={group.title ?? `grup-${String(index)}`} group={group} />
      ))}
    </div>
  )
}

/**
 * The product's description and its specs right under the buy area, every
 * word in the first HTML (docs/19 §6.5): one block of two tabs (sahip
 * 2026-11-05), "Ürün açıklaması" first, opening at about half when long,
 * then "Ürün özellikleri", the spec tables in their tile. The description is its
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
