import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { serviceName } from "@/features/ai/failure-text"

export interface AiTryOthersProps {
  /** The other services that can do the job; none: nothing is drawn. */
  services: readonly string[]
  onTryWith: (service: string) => void
  className?: string
  /**
   * Scrolled into sight when it appears: in a dialog whose body scrolls under a
   * fixed footer, the offer can fall below the fold after a long message.
   */
  reveal?: boolean
}

/**
 * "Başka servisle dene" (adr/0071 §4, §13): after a failure, one button
 * a service that could do the job instead. Never tried on its own: only
 * on a click.
 */
export function AiTryOthers({ services, onTryWith, className, reveal = false }: AiTryOthersProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const shown = services.length > 0
  useEffect(() => {
    if (reveal && shown) {
      ref.current?.scrollIntoView({ block: "nearest" })
    }
  }, [reveal, shown])
  if (services.length === 0) {
    return null
  }
  return (
    <div
      ref={ref}
      role="group"
      aria-label={t("ai.suggest.otherServices")}
      // Clear of a dialog's sticky footer (two stacked buttons on a phone) when scrolled to
      className={cn("flex scroll-mb-36 flex-col gap-2", className)}
    >
      <p className="text-xs text-muted-foreground">{t("ai.suggest.otherServices")}</p>
      <div className="flex flex-wrap gap-2">
        {services.map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onTryWith(id)
            }}
          >
            {t("ai.suggest.tryWith", { name: serviceName(t, id) })}
          </Button>
        ))}
      </div>
    </div>
  )
}
