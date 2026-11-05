import type { SpecGroupView, SpecView, Translate } from "@qticaret/ui"
import { RichText } from "./RichText"

function SpecRows({ rows }: { rows: SpecView[] }) {
  return rows.map((spec) => (
    <div
      key={spec.label}
      className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-b px-4 py-3 last:border-b-0"
    >
      <dt className="text-muted-foreground">{spec.label}</dt>
      <dd className="font-medium">{spec.value}</dd>
    </div>
  ))
}

/**
 * The product's description and its attributes, side by side on wide
 * screens, all in the first HTML: the description's content document as
 * the backend renders it (adr/0055), else its plain text paragraphs; the
 * attributes a definition list, in their template's sections when it has
 * them (adr/0013 Ek 2026-11-04), a section's name above its rows.
 */
export function ProductDetails({
  description,
  descriptionHtml,
  specs,
  specGroups,
  t,
}: {
  description: string[]
  descriptionHtml: string | null
  specs: SpecView[]
  specGroups?: SpecGroupView[] | undefined
  t: Translate
}) {
  const titled = (specGroups ?? []).some((group) => group.title !== null)
  const described = descriptionHtml !== null || description.length > 0
  if (!described && specs.length === 0) {
    return null
  }
  return (
    <div className="grid gap-10 border-t pt-12 lg:grid-cols-2 lg:gap-16">
      {described && (
        // `min-w-0`: a wide table wraps in its column instead of widening the grid
        <section aria-labelledby="urun-aciklamasi" className="flex min-w-0 flex-col gap-4">
          <h2 id="urun-aciklamasi" className="text-3xl leading-tight">
            {t("product.description")}
          </h2>
          {descriptionHtml !== null ? (
            <RichText html={descriptionHtml} />
          ) : (
            <div className="flex flex-col gap-3 text-[17px] leading-[1.75] text-foreground/85">
              {description.map((paragraph, index) => (
                <p key={String(index)}>{paragraph}</p>
              ))}
            </div>
          )}
        </section>
      )}
      {specs.length > 0 && (
        <section aria-labelledby="urun-ozellikleri" className="flex flex-col gap-4">
          <h2 id="urun-ozellikleri" className="text-3xl leading-tight">
            {t("product.specs")}
          </h2>
          {titled ? (
            (specGroups ?? []).map((group, index) => (
              <div key={group.title ?? `-${String(index)}`} className="flex flex-col gap-2">
                {group.title !== null && (
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                    {group.title}
                  </h3>
                )}
                <dl className="overflow-hidden rounded-2xl border bg-card text-sm">
                  <SpecRows rows={group.rows} />
                </dl>
              </div>
            ))
          ) : (
            <dl className="overflow-hidden rounded-2xl border bg-card text-sm">
              <SpecRows rows={specs} />
            </dl>
          )}
        </section>
      )}
    </div>
  )
}

/**
 * The shop's short description under the product's name (adr/0055 Ek
 * 2026-11-05): up to five plain lines as a dotted list, in place of the
 * headline facts.
 */
export function SummaryList({ lines, label }: { lines: readonly string[]; label: string }) {
  if (lines.length === 0) {
    return null
  }
  return (
    <ul aria-label={label} className="flex max-w-prose list-disc flex-col gap-1 ps-5 text-sm">
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line}`} className="marker:text-muted-foreground">
          {line}
        </li>
      ))}
    </ul>
  )
}

/** The shop's headline facts under the product's name ("N690 çelik", "21 cm"). */
export function SpecHighlights({ specs, label }: { specs: SpecView[]; label: string }) {
  const highlights = specs.filter((spec) => spec.highlight)
  if (highlights.length === 0) {
    return null
  }
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {highlights.map((spec) => (
        <li
          key={spec.label}
          className="rounded-full border bg-card px-3 py-1.5 text-xs"
          title={spec.label}
        >
          <span className="text-muted-foreground">{spec.label}: </span>
          <span className="font-medium">{spec.value}</span>
        </li>
      ))}
    </ul>
  )
}
