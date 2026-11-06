import { useQuery } from "@tanstack/react-query"
import { FileJson, KeyRound, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { apiAccessQuery, downloadOpenApi } from "@/features/settings/api/api-access"
import { ApiKeyDialog } from "@/features/settings/components/api-key-dialog"
import { ApiKeyList } from "@/features/settings/components/api-key-list"
import { WebhooksCard } from "@/features/settings/components/webhooks-card"
import { errorText } from "@/lib/errors"

const P = "settings.api"

/**
 * Settings > External API (F11.6, adr/0039 §6): keys for the shop's own
 * systems, each reaching only its scopes, shown once, revoked at once and
 * then deleted from the list; how to connect, and the OpenAPI document of what a key can reach.
 */
export function ApiAccessPage() {
  const { t } = useTranslation()
  const access = useQuery(apiAccessQuery())
  const [creating, setCreating] = useState(false)
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
            <ApiKeyList keys={keys} />
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
      <WebhooksCard />
      <ApiKeyDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
