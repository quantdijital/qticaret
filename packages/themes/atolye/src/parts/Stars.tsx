import { Star } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * Five stars for a rating out of five, filled to the nearest whole star
 * in the star token, for the eye only: the words beside them (or the
 * `label` given) say it to a screen reader.
 */
export function Stars({
  rating,
  label,
  className,
  size = "size-4",
}: {
  rating: number
  label?: string
  className?: string
  size?: string
}) {
  const filled = Math.round(rating)
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          className={cn(size, step <= filled ? "fill-star text-star" : "fill-paper-3 text-paper-3")}
          aria-hidden="true"
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}
