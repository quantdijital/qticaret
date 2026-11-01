import type { SpecView, Translate } from "@qticaret/ui"

/**
 * The product's description and its attributes, side by side on wide
 * screens: plain text and a definition list, all in the first HTML.
 */
export function ProductDetails({
  description,
  specs,
  t,
}: {
  description: string[]
  specs: SpecView[]
  t: Translate
}) {
  if (description.length === 0 && specs.length === 0) {
    return null
  }
  return (
    <div className="grid gap-10 border-t pt-12 lg:grid-cols-2 lg:gap-16">
      {description.length > 0 && (
        <section aria-labelledby="urun-aciklamasi" className="flex flex-col gap-4">
          <h2 id="urun-aciklamasi" className="text-3xl leading-tight">
            {t("product.description")}
          </h2>
          <div className="flex flex-col gap-3 text-[17px] leading-[1.75] text-foreground/85">
            {description.map((paragraph, index) => (
              <p key={String(index)}>{paragraph}</p>
            ))}
          </div>
        </section>
      )}
      {specs.length > 0 && (
        <section aria-labelledby="urun-ozellikleri" className="flex flex-col gap-4">
          <h2 id="urun-ozellikleri" className="text-3xl leading-tight">
            {t("product.specs")}
          </h2>
          <dl className="overflow-hidden rounded-2xl border bg-card text-sm">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-b px-4 py-3 last:border-b-0"
              >
                <dt className="text-muted-foreground">{spec.label}</dt>
                <dd className="font-medium">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
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
