import type { TFunction } from "i18next"

/** The SEO card folded to a line (a content page's secondary part, docs/18 §7 CollapsibleSection). */
export interface SeoCollapse {
  /** Its element id, for the advisor's jumps. */
  id: string
  /** Its name in the person's remembered choices. */
  name: string
  /** Said after the lengths: the advisor's findings for these fields ("2 öneri"). */
  note?: string | undefined
  /** An urgent finding for these fields: it opens. */
  attention?: boolean | undefined
}

interface Shown {
  /** What was typed. */
  own: string
  /** What results show: the typed text, else the template's or the page's own. */
  shown: string
  limit: number
}

/**
 * The search appearance in one line: each field's length against what
 * results show, said "(otomatik)" when the templates or the page's text
 * fill it ("Başlık 56/60 · Açıklama (otomatik) 142/155 · 2 öneri").
 */
export function seoSummary(
  t: TFunction,
  { title, description, note }: { title: Shown; description: Shown; note?: string | undefined }
): string {
  const length = (field: Shown) => ({ length: field.shown.length, limit: field.limit })
  return [
    t(title.own.trim() ? "seo.card.summary.title" : "seo.card.summary.titleAuto", length(title)),
    description.shown
      ? t(
          description.own.trim()
            ? "seo.card.summary.description"
            : "seo.card.summary.descriptionAuto",
          length(description)
        )
      : t("seo.card.summary.noDescription"),
    note,
  ]
    .filter(Boolean)
    .join(" · ")
}
