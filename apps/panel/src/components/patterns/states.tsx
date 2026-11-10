import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton rows while a section loads (docs/06: three states on every screen). */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation()
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

/** A failed load: what happened and a way to try again. */
export function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-destructive">{text}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  )
}

/** Nothing here yet: one sentence and one action (docs/18 §2). */
export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}
