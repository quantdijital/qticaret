import { useQuery } from "@tanstack/react-query"
import { Flag, Loader2, Send } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  cutoverQuery,
  inviteStatusQuery,
  useMarkCutover,
  useStartInvites,
} from "@/features/settings/api/migration"
import { errorText } from "@/lib/errors"
import { formatCount, formatDate } from "@qticaret/admin-ui/lib/format"

const C = "settings.migration.cutover"
const I = "settings.migration.invites"

/** The day the domain moved here: from it, thirty days of the storefront's 404s watched (F14.7). */
export function CutoverCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const cutover = useQuery(cutoverQuery())
  const mark = useMarkCutover()
  const [confirming, setConfirming] = useState(false)
  return (
    <SectionCard
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      {...(className ? { className } : {})}
    >
      <div className="flex flex-1 flex-col gap-4">
        {cutover.isPending ? (
          <Skeleton className="h-10 rounded-md" />
        ) : (
          <p className="text-sm">
            {cutover.data
              ? t(`${C}.watching`, {
                  date: formatDate(cutover.data.cutover_at),
                  until: formatDate(cutover.data.watch_until),
                })
              : t(`${C}.none`)}
          </p>
        )}
        <Button
          className="mt-auto self-start"
          variant="outline"
          disabled={mark.isPending}
          onClick={() => {
            setConfirming(true)
          }}
        >
          {mark.isPending ? <Loader2 className="animate-spin" /> : <Flag />}
          {t(`${C}.mark`)}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${C}.confirmTitle`)}
        description={t(`${C}.confirmText`)}
        confirmLabel={t(`${C}.mark`)}
        onConfirm={() => {
          setConfirming(false)
          mark.mutate(undefined, { onError: (failure) => toast.error(errorText(t, failure)) })
        }}
      />
    </SectionCard>
  )
}

const COUNTS = ["queued", "invited", "waiting", "today"] as const

/** Moved customers asked to open their accounts (F14.5): where the queue stands, and its start. */
export function InvitesCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const status = useQuery(inviteStatusQuery())
  const start = useStartInvites()
  const [confirming, setConfirming] = useState(false)
  return (
    <SectionCard
      title={t(`${I}.title`)}
      description={t(`${I}.description`)}
      {...(className ? { className } : {})}
    >
      <div className="flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COUNTS.map((count) => (
            <div key={count} className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
              <dt className="text-[13px] text-muted-foreground">{t(`${I}.counts.${count}`)}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {status.data ? formatCount(status.data[count]) : "–"}
              </dd>
            </div>
          ))}
        </dl>
        <Button
          className="mt-auto self-start"
          disabled={start.isPending}
          onClick={() => {
            setConfirming(true)
          }}
        >
          {start.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {t(`${I}.start`)}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${I}.confirmTitle`)}
        description={t(`${I}.confirmText`)}
        confirmLabel={t(`${I}.start`)}
        onConfirm={() => {
          setConfirming(false)
          start.mutate(undefined, {
            onSuccess: () => toast.success(t(`${I}.started`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </SectionCard>
  )
}
