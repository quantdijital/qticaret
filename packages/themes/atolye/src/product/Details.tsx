import type { ProductPageView, SpecGroupView, Translate } from "@qticaret/ui"
import { Beside } from "./Beside"
import { InfoTabs, type InfoTab } from "./InfoTabs"
import { ProgramSteps } from "../sections/Program"
import { PROSE_INLINE, PROSE_LISTS } from "./prose"
import { ReadMore } from "./ReadMore"
import { ShippingCard } from "./Shipping"
import { Specs } from "./Specs"
import { infoWords } from "./words"

/**
 * The description's own type: the content pages' reading measure (46rem,
 * owner 2026-11-06: "yazılı içeriklerin genişliğini artıralım"; the tab
 * column where narrower), its headings a step above the body.
 */
const PROSE = [
  "flex max-w-[46rem] min-w-0 flex-col gap-4 text-md leading-[1.75] text-text-2 lg:text-[1.0625rem] [&_p]:max-w-none",
  "[&_h2]:mt-8 [&_h2]:max-w-none [&_h2]:text-title [&_h2]:leading-snug [&_h2]:text-text [&_h2:first-child]:mt-0",
  "[&_h3]:mt-4 [&_h3]:text-md [&_h3]:text-text [&_h4]:font-semibold [&_h4]:text-text",
  PROSE_LISTS,
  PROSE_INLINE,
  "[&_blockquote]:rounded-media [&_blockquote]:bg-paper-2 [&_blockquote]:p-4",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border-b [&_td]:border-rule [&_td]:py-2 [&_td]:pr-3 [&_th]:border-b [&_th]:border-rule [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text [&_b]:font-semibold",
].join(" ")

/** The spec table's sections: the template's groups, else one untitled group of every spec; those with a value. */
const groupsOf = (view: ProductPageView): SpecGroupView[] =>
  (view.specGroups && view.specGroups.length > 0
    ? view.specGroups
    : [{ title: null, rows: view.specs }]
  ).filter((group) => group.rows.some((spec) => spec.value.trim() !== ""))

/** The description's length past which it opens closed: about half a phone's screen of text. */
const LONG = 700

const lengthOf = (view: ProductPageView) =>
  view.descriptionHtml !== null
    ? view.descriptionHtml.replace(/<[^>]*>/g, "").length
    : view.description.join(" ").length

/**
 * The product's description and its specs right under the buy area, every
 * word in the first HTML (docs/19 §6.5): one block of two tabs (sahip
 * 2026-11-05), "Ürün açıklaması" first, opening at about half when long,
 * then "Ürün özellikleri", the one spec table. The description is its
 * content document as the backend renders it (adr/0055, its allow-listed
 * HTML, its own spec table kept inside as the shop wrote it), else its
 * plain paragraphs. With only one of the two there are no tabs: that one
 * under its own heading. A shipped product's "Kargo ve Teslimat" card
 * stands beside them whichever tab is open (owner 2026-11-05), alone when
 * the product has neither. A program the shop put among them (`program.place:
 * tab`, adr/0078) is the last tab, its steps drawn as its section's.
 */
export function Details({ view, t }: { view: ProductPageView; t: Translate }) {
  const groups = groupsOf(view)
  const described = view.descriptionHtml !== null || view.description.length > 0
  const card = view.shipping ? <ShippingCard shipping={view.shipping} t={t} /> : null
  const program = view.program ?? null
  if (!described && groups.length === 0 && !program) {
    return card ? <div className="max-w-xl">{card}</div> : null
  }
  const words = infoWords(t, view.unshipped === true)
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
  // The shop's program as a third tab (`program.place: tab`), its steps as drawn below otherwise
  const tabs: InfoTab[] = [
    ...(description
      ? [
          {
            id: "aciklama",
            headingId: "urun-aciklamasi",
            title: words.description,
            content: description,
          },
        ]
      : []),
    ...(specs
      ? [{ id: "ozellikler", headingId: "urun-ozellikleri", title: words.specs, content: specs }]
      : []),
    ...(program
      ? [
          {
            id: "program",
            headingId: "urun-programi",
            title: program.title,
            content: (
              <div className="w-full max-w-4xl">
                <ProgramSteps section={program} />
              </div>
            ),
          },
        ]
      : []),
  ]
  const [only] = tabs
  if (tabs.length > 1) {
    return <InfoTabs label={words.tabs} aside={card} tabs={tabs} />
  }
  if (!only) {
    return null
  }
  return (
    <section aria-labelledby={only.headingId} className="flex min-w-0 flex-col gap-5">
      <h2 id={only.headingId} className="text-section">
        {only.title}
      </h2>
      <Beside aside={card}>{only.content}</Beside>
    </section>
  )
}
