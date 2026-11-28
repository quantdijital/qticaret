import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"

/** Yorumlar ve sorular: the two queues customers' words wait in (docs/06 principle 10). */
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
