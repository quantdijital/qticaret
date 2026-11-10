import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { EmailFrame } from "@/features/bulk-messages/editor/email-frame"
import { draftPreviewQuery } from "@/features/settings/api/customer-messages"
import type {
  CustomerMessage,
  CustomerMessageInput,
} from "@/features/settings/api/customer-messages"
import { messagePreviewQuery } from "@/features/settings/api/messaging"
import { errorText } from "@/lib/errors"

const C = "settings.notifications.customer"
const NAMES = "settings.notifications.templates.names"

/** How long typing must rest before the preview is asked for again. */
export const PREVIEW_DELAY_MS = 500

/** The value once it has stopped changing for `delay`. */
function useSettled<T>(value: T, delay: number): T {
  const key = JSON.stringify(value)
  const [settled, setSettled] = useState(key)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettled(key)
    }, delay)
    return () => {
      window.clearTimeout(timer)
    }
  }, [key, delay])
  return JSON.parse(settled) as T
}

/**
 * The message as a customer would get it, made-up values in the shop's
 * brand, with the words as typed (the server renders the draft; nothing
 * is kept or sent). Someone who may not change the words sees it as saved.
 */
export function CustomerMessagePreview({
  message,
  draft,
  editable,
  valid,
  channel,
}: {
  message: CustomerMessage
  draft: CustomerMessageInput
  /** Whether the staff member may change the words: else the saved preview. */
  editable: boolean
  /** No unknown `{belirteç}`: a draft the server would take. */
  valid: boolean
  channel: "email" | "sms"
}) {
  const { t } = useTranslation()
  const settled = useSettled(draft, PREVIEW_DELAY_MS)
  const typed = useQuery(draftPreviewQuery(message.name, settled, editable && valid))
  const saved = useQuery({ ...messagePreviewQuery(message.name), enabled: !editable })
  const query = editable ? typed : saved
  const preview = query.data
  if (query.isError && !preview) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!preview) {
    return <Skeleton className="h-80 w-full" />
  }
  // The last good rendering stays; why the words now are not taken is said under it
  const note = !valid ? (
    <p className="text-xs text-muted-foreground">{t(`${C}.previewHeld`)}</p>
  ) : query.isError ? (
    <p role="alert" className="text-xs text-destructive-text">
      {errorText(t, query.error)}
    </p>
  ) : null
  if (channel === "sms") {
    return (
      <section aria-label={t(`${C}.previewSms`)} className="flex flex-col gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">{t(`${C}.previewSms`)}</h4>
        <p className="rounded-lg border bg-muted/40 p-3 text-sm break-words whitespace-pre-wrap">
          {preview.sms ?? ""}
        </p>
        {note}
      </section>
    )
  }
  return (
    <section aria-label={t(`${C}.previewEmail`)} className="flex min-w-0 flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground">{t(`${C}.previewEmail`)}</h4>
      <p className="truncate text-sm">
        <span className="text-muted-foreground">{t(`${C}.fields.subject`)}: </span>
        {preview.email?.subject ?? ""}
      </p>
      <EmailFrame
        html={preview.email?.html ?? ""}
        device="desktop"
        title={t(`${C}.emailFrame`, { name: t(`${NAMES}.${message.name}`) })}
      />
      {note}
    </section>
  )
}
