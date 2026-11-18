import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"

export interface AiEditedBadgeProps {
  /** `icon`: a small mark over a thumbnail, its words as its name; `full`: the words beside it. */
  look?: "icon" | "full"
  className?: string
}

/**
 * "Yapay zekâyla düzenlendi" (adr/0071 §10): a picture an AI service
 * made from one of the shop's (`ai_source: edited`), marked wherever the
 * panel shows it. Its file carries the same fact (IPTC DigitalSourceType).
 */
export function AiEditedBadge({ look = "full", className }: AiEditedBadgeProps) {
  const { t } = useTranslation()
  const words = t("ai.background.edited")
  if (look === "icon") {
    return (
      <span
        role="img"
        aria-label={words}
        title={words}
        className={cn(
          "flex size-6 items-center justify-center rounded-full bg-background/90 text-primary-text shadow-sm",
          className
        )}
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        className
      )}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      {words}
    </span>
  )
}
