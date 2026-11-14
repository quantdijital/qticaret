import { ExternalLink } from "lucide-react"
import type { Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Stars } from "../parts/Stars"
import { type Of, headingId } from "./plan"
import { ReviewQuote } from "./ReviewQuote"
import { quoteOf } from "./Reviews"
import { SectionHead } from "./SectionHead"

/**
 * Google's rating of the shop on the home page (adr/0058 Ek 2026-11-06),
 * compact and light: on a tinted well Google's own average set large, the
 * stars and the word "Google", "Google'da N değerlendirme" to `/yorumlar`
 * and, if the shop wants, "Google'da gör" out to Google Maps (new tab).
 * Beside it (under it on a phone) up to three recent 4–5 star excerpts as
 * quotes: stars, the first sentence, who and when. Without excerpts the
 * well runs the container's width, its links on the right. Text only:
 * none of it goes into structured data; no Google logo (the word only).
 */
export function GoogleRating({ section, t }: { section: Of<"google_rating">; t: Translate }) {
  const id = headingId(section.id)
  const excerpts = section.excerpts.slice(0, 3)
  const wide = excerpts.length === 0
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={section.title} />
        <div className="grid gap-(--gap-columns) lg:grid-cols-12">
          <div
            className={cn(
              "flex flex-col gap-5 rounded-tile bg-paper-2 p-6 lg:p-8",
              wide
                ? "md:flex-row md:items-center md:justify-between lg:col-span-12"
                : "lg:col-span-4"
            )}
          >
            <p className="flex items-end gap-3">
              {section.average && (
                <span
                  aria-hidden="true"
                  className="tabular text-figure leading-none font-extrabold tracking-(--tracking-display)"
                >
                  {section.average}
                </span>
              )}
              <span aria-hidden="true" className="flex flex-col gap-1 pb-1">
                {section.rating !== null && <Stars rating={section.rating} size="size-5" />}
                <span className="text-sm font-semibold text-text">Google</span>
              </span>
              <span className="sr-only">{section.label}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={section.reviews.path} className="gf-btn gf-btn--quiet">
                {section.reviews.label}
              </a>
              {section.profileUrl && (
                <a
                  href={section.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gf-btn gf-btn--quiet"
                >
                  {t("home.google_rating_profile")}
                  <span className="sr-only"> {t("reviews.google_new_tab")}</span>
                  <ExternalLink className="size-4.5" aria-hidden="true" strokeWidth={2} />
                </a>
              )}
            </div>
          </div>
          {!wide && (
            <ul
              aria-label={t("home.google_rating_excerpts")}
              className="grid gap-(--gap-columns) md:grid-cols-[repeat(3,minmax(0,1fr))] lg:col-span-8"
            >
              {excerpts.map((excerpt, index) => (
                <li
                  key={`${excerpt.author}:${excerpt.date.dateTime}:${String(index)}`}
                  className="flex flex-col gap-3 rounded-tile border border-rule p-5 lg:p-6"
                >
                  <Stars rating={excerpt.rating} label={excerpt.ratingLabel} />
                  <blockquote className="flex flex-col gap-1 text-md leading-relaxed font-semibold break-words">
                    <ReviewQuote
                      text={quoteOf(excerpt.text)}
                      more={t("product.read_more")}
                      less={t("product.read_less")}
                    />
                  </blockquote>
                  <footer className="mt-auto flex flex-col pt-2 text-sm">
                    <span className="truncate font-semibold text-text">{excerpt.author}</span>
                    <time dateTime={excerpt.date.dateTime} className="text-text-3">
                      {excerpt.date.label}
                    </time>
                  </footer>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  )
}
