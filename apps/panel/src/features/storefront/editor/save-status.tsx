import { CircleAlert, CloudCheck, Loader2, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { SaveStatus as Status } from "@/features/storefront/layout/use-autosave"

const S = "storefront.editor.status"

const TIME = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" })

interface SaveStatusProps {
  status: Status
  /** A change is waiting to be stored. */
  dirty: boolean
  /** A field has a mistake: nothing is sent until it is fixed. */
  blocked: boolean
  onRetry: () => void
}

/**
 * Where the draft stands: being saved, saved at a time, waiting for a
 * mistake to be fixed, or refused with the server's reason and a retry.
 * Read out as it changes.
 */
export function SaveStatus({ status, dirty, blocked, onRetry }: SaveStatusProps) {
  const { t } = useTranslation()
  let body
  if (status.kind === "error" && dirty) {
    body = (
      <>
        <CircleAlert className="size-4 shrink-0 text-destructive-text" aria-hidden="true" />
        <span
          className="min-w-0 truncate text-destructive-text max-sm:sr-only"
          title={status.message}
        >
          {t(`${S}.error`, { message: status.message })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t(`${S}.retry`)}
          title={t(`${S}.retry`)}
          className="shrink-0 max-sm:w-8 max-sm:px-0"
          onClick={onRetry}
        >
          <RotateCw />
          <span className="max-sm:hidden">{t(`${S}.retry`)}</span>
        </Button>
      </>
    )
  } else if (blocked && dirty) {
    body = (
      <>
        <CircleAlert className="size-4 shrink-0 text-warning-text" aria-hidden="true" />
        <span className="truncate text-warning-text max-sm:sr-only">{t(`${S}.invalid`)}</span>
      </>
    )
  } else if (dirty || status.kind === "saving") {
    body = (
      <>
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        <span className="truncate max-sm:sr-only">{t(`${S}.saving`)}</span>
      </>
    )
  } else {
    body = (
      <>
        <CloudCheck className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate max-sm:sr-only">
          {status.kind === "saved"
            ? t(`${S}.saved`, { time: TIME.format(status.at) })
            : t(`${S}.idle`)}
        </span>
      </>
    )
  }
  return (
    <div
      role="status"
      aria-label={t(`${S}.label`)}
      // On a phone the icon alone, its words still read out
      className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
    >
      {body}
    </div>
  )
}
