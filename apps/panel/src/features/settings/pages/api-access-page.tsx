import { useQuery } from "@tanstack/react-query"
import { FileJson, KeyRound, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  apiAccessQuery,
  downloadOpenApi,
  scopeKey,
  useRevokeApiKey,
} from "@/features/settings/api/api-access"
import type { ApiKeyRow } from "@/features/settings/api/api-access"
import { ApiKeyDialog } from "@/features/settings/components/api-key-dialog"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const P = "settings.api"

/** One key: its name, masked form, what it reaches, and a way to revoke it. */
function KeyRow({ row, onRevoke }: { row: ApiKeyRow; onRevoke: (row: ApiKeyRow) => void }) {
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
        </span>
      </div>
      {revoked ? null : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onRevoke(row)
          }}
        >
          {t(`${P}.revoke`)}
        </Button>
      )}
    </li>
  )
}

/**
 * Settings > External API (F11.6, adr/0039 §6): keys for the shop's own
 * systems, each reaching only its scopes, shown once and revoked at once;
 * how to connect, and the OpenAPI document of what a key can reach.
 */
export function ApiAccessPage() {
  const { t } = useTranslation()
  const access = useQuery(apiAccessQuery())
  const revoke = useRevokeApiKey()
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null)
  const keys = access.data?.keys ?? []
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader title={t(`${P}.title`)} description={t(`${P}.subtitle`)} />
      <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title={t(`${P}.keys`)}
          description={t(`${P}.keysHint`)}
          flush
          className="h-full"
          action={
            <Button
              size="sm"
              onClick={() => {
                setCreating(true)
              }}
            >
              <Plus />
              {t(`${P}.new`)}
            </Button>
          }
        >
          {access.isPending ? (
            <LoadingRows />
          ) : access.isError ? (
            <ErrorState text={errorText(t, access.error)} onRetry={() => void access.refetch()} />
          ) : keys.length === 0 ? (
            <p className="border-t px-5 py-4 text-sm text-muted-foreground">{t(`${P}.empty`)}</p>
          ) : (
            <ul>
              {keys.map((row) => (
                <KeyRow key={row.id} row={row} onRevoke={setRevoking} />
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard
          title={t(`${P}.connect.title`)}
          description={t(`${P}.connect.hint`)}
          className="h-full"
        >
          <div className="flex h-full flex-col gap-3 text-[13px]">
            <p className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {t(`${P}.connect.auth`)}
            </p>
            <code className="block rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
              {`curl -u sk_…: ${window.location.origin}/admin/orders?limit=20`}
            </code>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {(["closed", "limit", "revoke"] as const).map((key) => (
                <li key={key}>{t(`${P}.connect.rules.${key}`)}</li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-auto self-start"
              onClick={() => {
                downloadOpenApi().catch((failure: unknown) => toast.error(errorText(t, failure)))
              }}
            >
              <FileJson />
              {t(`${P}.connect.openapi`)}
            </Button>
          </div>
        </SectionCard>
      </div>
      <ApiKeyDialog open={creating} onOpenChange={setCreating} />
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
    </div>
  )
}
