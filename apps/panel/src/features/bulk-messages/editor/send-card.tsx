import { CalendarClock, Loader2, Send } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useScheduleBulkMessage,
  useSendBulkMessage,
} from "@/features/bulk-messages/api/bulk-messages"
import type { AudiencePreview, BulkChannel } from "@/features/bulk-messages/api/types"
import { hourText, readSchedule, withinSmsHours } from "@/features/bulk-messages/schedule"
import { errorText } from "@/lib/errors"
import { formatCount, formatDateTime } from "@/lib/format"
import { isReauthCancelled } from "@/lib/reauth"

const S = "bulkMessages.send"

type Asking = { kind: "now" } | { kind: "schedule"; at: string } | null

/**
 * "Şimdi gönder" and "Zamanla" (adr/0050 §6–7): each asked once more in
 * words, then the person proves themselves again (the API's 428 opens the
 * dialog). What the backend refuses (no sender domain, no SMS account or
 * opt-out line, a time out of range) is said here in its own words.
 */
export function SendCard({
  id,
  channel,
  preview,
  hours,
  blocked,
  now = new Date(),
}: {
  id: string
  channel: BulkChannel
  preview: AudiencePreview | undefined
  hours: { start: number; end: number } | null
  /** Why it cannot go yet, in words; none: it can. */
  blocked: string | null
  now?: Date
}) {
  const { t } = useTranslation()
  const send = useSendBulkMessage(id)
  const schedule = useScheduleBulkMessage(id)
  const [local, setLocal] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [asking, setAsking] = useState<Asking>(null)
  const busy = send.isPending || schedule.isPending
  const disabled = blocked !== null || busy
  const people = preview ? formatCount(preview.eligible) : null
  // A text sent now outside its hours waits for them (the backend pauses it, `quiet_hours`)
  const quiet =
    channel === "sms" && hours && !withinSmsHours(now, hours.start, hours.end) ? hours : null
  const failed = (error: unknown) => {
    // Closing the proof dialog changes nothing: no need to say so in red
    setFailure(isReauthCancelled(error) ? null : errorText(t, error))
  }
  const confirm = () => {
    const current = asking
    setAsking(null)
    setFailure(null)
    if (current?.kind === "now") {
      // Sent, the page turns into its report and this card goes: the promise still answers
      send.mutateAsync().then(() => toast.success(t(`${S}.started`)), failed)
    } else if (current?.kind === "schedule") {
      schedule
        .mutateAsync(current.at)
        .then(
          () => toast.success(t(`${S}.scheduled`, { when: formatDateTime(current.at) })),
          failed
        )
    }
  }
  return (
    <SectionCard title={t(`${S}.title`)} description={t(`${S}.description`)}>
      <div className="flex flex-1 flex-col gap-4">
        {preview && preview.quota.later > 0 ? (
          <p className="text-[13px] text-warning-text">
            {t(`${S}.quota`, {
              today: formatCount(preview.quota.today),
              later: formatCount(preview.quota.later),
            })}
          </p>
        ) : null}
        {quiet ? (
          <p className="text-[13px] text-muted-foreground">
            {t(`${S}.quiet`, { start: hourText(quiet.start), end: hourText(quiet.end) })}
          </p>
        ) : null}
        {blocked ? <p className="text-[13px] text-muted-foreground">{blocked}</p> : null}
        <Button
          className="self-start"
          disabled={disabled}
          onClick={() => {
            setAsking({ kind: "now" })
          }}
        >
          {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {t(`${S}.now`)}
        </Button>
        <form
          noValidate
          className="flex flex-col gap-2 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault()
            const read = readSchedule(local)
            setProblem(read.problem ? t(`${S}.problems.${read.problem}`) : null)
            if (read.at) {
              setAsking({ kind: "schedule", at: read.at })
            }
          }}
        >
          <label htmlFor="bulk-schedule-at" className="text-sm font-medium">
            {t(`${S}.at`)}
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="bulk-schedule-at"
              type="datetime-local"
              className="w-56"
              value={local}
              aria-invalid={problem ? true : undefined}
              onChange={(event) => {
                setLocal(event.target.value)
                setProblem(null)
              }}
            />
            <Button type="submit" variant="outline" disabled={disabled}>
              {schedule.isPending ? <Loader2 className="animate-spin" /> : <CalendarClock />}
              {t(`${S}.schedule`)}
            </Button>
          </div>
          {problem ? (
            <p role="alert" className="text-xs text-destructive-text">
              {problem}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t(`${S}.atHint`)}</p>
          )}
        </form>
        {failure ? (
          <p role="alert" className="text-[13px] text-destructive-text">
            {failure}
          </p>
        ) : null}
        <p className="mt-auto text-xs text-muted-foreground">{t(`${S}.reauthNote`)}</p>
      </div>
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAsking(null)
          }
        }}
        title={
          asking?.kind === "schedule"
            ? t(`${S}.confirmSchedule.title`, { when: formatDateTime(asking.at) })
            : people
              ? t(`${S}.confirmNow.title`, { count: preview?.eligible ?? 0, people })
              : t(`${S}.confirmNow.titleUnknown`)
        }
        description={t(
          asking?.kind === "schedule"
            ? `${S}.confirmSchedule.description`
            : `${S}.confirmNow.description`
        )}
        confirmLabel={t(asking?.kind === "schedule" ? `${S}.schedule` : `${S}.now`)}
        onConfirm={confirm}
      />
    </SectionCard>
  )
}
