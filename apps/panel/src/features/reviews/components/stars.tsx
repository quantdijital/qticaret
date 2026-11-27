import { Star } from "lucide-react"
import { useTranslation } from "react-i18next"

/** A review's stars, filled to its rating, read out as one picture. */
export function Stars({ rating }: { rating: number }) {
  const { t } = useTranslation()
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={t("reviews.stars", { rating })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={
            star <= rating ? "size-4 fill-warning text-warning" : "size-4 text-muted-foreground/40"
          }
        />
      ))}
    </span>
  )
}
