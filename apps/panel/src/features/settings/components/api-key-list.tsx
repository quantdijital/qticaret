import { ChevronRight } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { scopeKey, useDeleteApiKey, useRevokeApiKey } from "@/features/settings/api/api-access"
import type { ApiKeyRow } from "@/features/settings/api/api-access"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const P = "settings.api"

/** One key: its name, masked form, what it reaches; revoke while active, delete once revoked. */
function KeyRow({ row, onAction }: { row: ApiKeyRow; onAction: (row: ApiKeyRow) => void }) {
  const { t } = useTranslation()
  const revoked = row.revoked_at !== null
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3">
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          {row.title}
          <StatusBadge tone={revoked ? "neutral" : "success"}>
            {t(revoked ? `${P}.revoked` : `${P}.active`)}
          </StatusBadge>
        </span>
        <span className="font-mono text-xs text-muted-foreground">{row.redacted}</span>
        <span className="text-xs text-muted-foreground">
          {row.scopes.map((scope) => t(`${P}.scopes.${scopeKey(scope)}.name`)).join(" · ")}
          {" · "}
          {t(`${P}.made`, { date: formatDate(row.created_at) })}
          {row.revoked_at ? (
            <>
              {" · "}
              {t(`${P}.revokedOn`, { date: formatDate(row.revoked_at) })}
            </>
          ) : null}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onAction(row)
        }}
      >
        {t(revoked ? `${P}.delete` : `${P}.revoke`)}
      </Button>
    </li>
  )
}

const revokedTime = (row: ApiKeyRow) => (row.revoked_at ? new Date(row.revoked_at).getTime() : 0)

/**
 * The shop's keys: the active ones first; the revoked ones folded under
 * "İptal edilenler (n)", latest first, each to delete for good.
 */
export function ApiKeyList({ keys }: { keys: readonly ApiKeyRow[] }) {
  const { t } = useTranslation()
  const revoke = useRevokeApiKey()
  const remove = useDeleteApiKey()
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null)
  const [deleting, setDeleting] = useState<ApiKeyRow | null>(null)
  const [showRevoked, setShowRevoked] = useState(false)
  const group = useId()
  const active = keys.filter((row) => row.revoked_at === null)
  const revoked = keys
    .filter((row) => row.revoked_at !== null)
    .sort((a, b) => revokedTime(b) - revokedTime(a))
  return (
    <>
      <ul>
        {active.length === 0 ? (
          <li className="border-t px-5 py-4 text-sm text-muted-foreground">{t(`${P}.noActive`)}</li>
        ) : (
          active.map((row) => <KeyRow key={row.id} row={row} onAction={setRevoking} />)
        )}
      </ul>
      {revoked.length > 0 ? (
        <div className="border-t">
          <button
            type="button"
            aria-expanded={showRevoked}
            aria-controls={group}
            onClick={() => {
              setShowRevoked((open) => !open)
            }}
            className="flex min-h-11 w-full items-center gap-2 px-5 py-2 text-left text-[13px] text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn("size-4 shrink-0 transition-transform", showRevoked && "rotate-90")}
            />
            {t(`${P}.revokedGroup`, { count: revoked.length })}
          </button>
          <ul id={group} hidden={!showRevoked}>
            {showRevoked
              ? revoked.map((row) => <KeyRow key={row.id} row={row} onAction={setDeleting} />)
              : null}
          </ul>
        </div>
      ) : null}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null)
          }
        }}
        title={t(`${P}.revokeTitle`, { name: revoking?.title ?? "" })}
        description={t(`${P}.revokeHint`)}
        confirmLabel={t(`${P}.revoke`)}
        destructive
        onConfirm={() => {
          if (revoking) {
            revoke.mutate(revoking.id, {
              onSuccess: () => toast.success(t(`${P}.revokedToast`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setRevoking(null)
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        title={t(`${P}.deleteTitle`, { name: deleting?.title ?? "" })}
        description={t(`${P}.deleteHint`)}
        confirmLabel={t(`${P}.delete`)}
        destructive
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSuccess: () => toast.success(t(`${P}.deletedToast`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setDeleting(null)
        }}
      />
    </>
  )
}
