import type { HomeSectionView, Translate } from "@qticaret/ui"
import { SectionHead, headingId } from "./SectionHead"

type GoogleRating = Extract<HomeSectionView, { type: "google_rating" }>

/**
 * Google's rating of the shop, plain (adr/0058 Ek 2026-11-06): the
 * average and count in a line, links to the reviews page and to Google,
 * the excerpts as a list. Text only, never structured data.
 */
export function GoogleRatingSection({ section, t }: { section: GoogleRating; t: Translate }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <SectionHead id={id} title={section.title} more={section.reviews} />
      <p className="text-muted-foreground">{section.label}</p>
      {section.profileUrl && (
        <a
          href={section.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm font-medium underline"
        >
          {t("home.google_rating_profile")}
          <span className="sr-only"> {t("reviews.google_new_tab")}</span>
        </a>
      )}
      {section.excerpts.length > 0 && (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {section.excerpts.map((excerpt, index) => (
            <li key={String(index)} className="flex flex-col gap-1 p-5 text-sm">
              <span>{excerpt.ratingLabel}</span>
              <p className="line-clamp-3">{excerpt.text}</p>
              <p className="text-xs text-muted-foreground">
                {excerpt.author} ·{" "}
                <time dateTime={excerpt.date.dateTime}>{excerpt.date.label}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
