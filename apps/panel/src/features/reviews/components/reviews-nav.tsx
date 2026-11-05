import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionNav } from "@/components/patterns/section-nav"
import { googleReviewsQuery } from "@/features/reviews/api/google-reviews"

/**
 * Yorumlar ve sorular: the two queues customers' words wait in, and the
 * shop's Google reviews (adr/0058) once the platform has opened Google
 * (docs/06 principle 10).
 */
export function ReviewsNav() {
  const { t } = useTranslation()
  const google = useQuery(googleReviewsQuery())
  return (
    <SectionNav
      label={t("reviews.sections")}
      items={[
        { to: "/reviews", label: t("reviews.sectionReviews") },
        { to: "/reviews/questions", label: t("reviews.sectionQuestions") },
        ...(google.data?.google_reviews.configured === true
          ? [{ to: "/reviews/google", label: t("reviews.sectionGoogle") }]
          : []),
      ]}
    />
  )
}
