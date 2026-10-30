import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  exportJobQuery,
  useClosePrivacyRequest,
  useEraseCustomer,
  useStartExport,
} from "@/features/customers/api/privacy"
import type { PrivacyRequest } from "@/features/customers/api/privacy"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"
import { ReauthCancelled } from "@/lib/reauth"

const P = "customers.privacy"

/** Past the 30 days the law gives. */
const isLate = (request: PrivacyRequest): boolean => new Date(request.due_at).getTime() < Date.now()

function StatusOf({ request }: { request: PrivacyRequest }) {
  const { t } = useTranslation()
  if (request.status !== "open") {
    return (
      <StatusBadge tone={request.status === "completed" ? "success" : "neutral"}>
        {t(`${P}.status.${request.status}`)}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone={isLate(request) ? "danger" : "warning"}>
      {t(`${P}.status.open`, { date: formatDate(request.due_at) })}
    </StatusBadge>
  )
}

/** An export's file: prepared on demand, downloaded, then the request is answered. */
function ExportActions({ customerId, request }: { customerId: string; request: PrivacyRequest }) {
  const { t } = useTranslation()
  const start = useStartExport(customerId)
  const job = useQuery({ ...exportJobQuery(request.job_id ?? ""), enabled: !!request.job_id })
  const running = job.data?.status === "queued" || job.data?.status === "running"
  if (job.data?.has_result) {
    return <JobDownloadButton job={job.data} label={t(`${P}.download`)} />
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={running || start.isPending}
      onClick={() => {
        start.mutate(request.id, { onError: (failure) => toast.error(errorText(t, failure)) })
      }}
    >
      {running || start.isPending ? <Loader2 className="animate-spin" /> : null}
      {t(running ? `${P}.preparing` : `${P}.prepare`)}
    </Button>
  )
}

/**
 * One KVKK request (F13.5): what was asked, how and when, until when it
 * must be answered; for an open one, what staff may do with it.
 */
export function PrivacyRequestRow({
  customerId,
  request,
  canAct,
}: {
  customerId: string
  request: PrivacyRequest
  canAct: boolean
}) {
  const { t } = useTranslation()
  const close = useClosePrivacyRequest(customerId)
  const erase = useEraseCustomer()
  const [confirming, setConfirming] = useState(false)
  const done = (status: "completed" | "rejected") => {
    close.mutate(
      { id: request.id, status },
      {
        onSuccess: () => toast.success(t(`${P}.closed.${status}`)),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <li className="flex flex-col gap-3 border-t px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{t(`${P}.kinds.${request.kind}`)}</span>
          <span className="text-[13px] text-muted-foreground">
            {t(`${P}.received`, {
              channel: t(`${P}.channels.${request.channel}`),
              date: formatDate(request.received_at),
            })}
          </span>
        </div>
        <StatusOf request={request} />
      </div>
      {canAct && request.status === "open" ? (
        <div className="flex flex-wrap gap-2">
          {request.kind === "export" ? (
            <>
              <ExportActions customerId={customerId} request={request} />
              <Button
                variant="outline"
                size="sm"
                disabled={!request.job_id || close.isPending}
                onClick={() => {
                  done("completed")
                }}
              >
                {t(`${P}.sent`)}
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              disabled={erase.isPending}
              onClick={() => {
                setConfirming(true)
              }}
            >
              {erase.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${P}.erase`)}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={close.isPending}
            onClick={() => {
              done("rejected")
            }}
          >
            {t(`${P}.reject`)}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${P}.eraseTitle`)}
        description={t(`${P}.eraseDescription`)}
        confirmLabel={t(`${P}.eraseConfirm`)}
        destructive
        onConfirm={() => {
          erase.mutate(request.id, {
            onSuccess: () => toast.success(t(`${P}.erased`)),
            onError: (failure) => {
              if (!(failure instanceof ReauthCancelled)) {
                toast.error(errorText(t, failure))
              }
            },
          })
        }}
      />
    </li>
  )
}
