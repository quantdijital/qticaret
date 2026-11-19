import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { serviceName } from "@/features/ai/failure-text"

export interface AiTryOthersProps {
  /** The other services that can do the job; none: nothing is drawn. */
  services: readonly string[]
  onTryWith: (service: string) => void
  className?: string
}

/**
 * "Başka servisle dene" (adr/0071 §4, §13): after a failure, one button
 * a service that could do the job instead. Never tried on its own: only
 * on a click.
 */
export function AiTryOthers({ services, onTryWith, className }: AiTryOthersProps) {
  const { t } = useTranslation()
  if (services.length === 0) {
    return null
  }
  return (
    <div
      role="group"
      aria-label={t("ai.suggest.otherServices")}
      className={cn("flex flex-col gap-2", className)}
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
