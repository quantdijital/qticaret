import { Button, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"

/** Skeleton rows while a section loads (docs/06: three states on every screen). */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation()
  return (
    <div aria-busy="true" aria-label={t("qticaret.common.loading")} className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="bg-ui-bg-component h-10 w-full animate-pulse rounded" />
      ))}
    </div>
  )
}

/** A failed load: what happened and a way to try again. */
export function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <Text size="small" className="text-ui-fg-error">
        {text}
      </Text>
      <Button size="small" variant="secondary" onClick={onRetry}>
        {t("qticaret.common.retry")}
      </Button>
    </div>
  )
}
