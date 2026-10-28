import { useTranslation } from "react-i18next"
import { SectionNav } from "@/components/patterns/section-nav"

/** Yorumlar ve sorular: the two queues customers' words wait in. */
export function ReviewsNav() {
  const { t } = useTranslation()
  return (
    <SectionNav
      label={t("reviews.sections")}
      items={[
        { to: "/reviews", label: t("reviews.sectionReviews") },
        { to: "/reviews/questions", label: t("reviews.sectionQuestions") },
      ]}
    />
  )
}
