import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { provisioningQuery } from "@/features/provisioning/api"
import type { ProvisioningState } from "@/features/provisioning/api"
import { tenantKey } from "@/features/tenants/api"
import type { TenantDetail } from "@/features/tenants/api"
import { errorText } from "@/lib/errors"
import { ActionsCard } from "./actions-card"
import { HistoryCard } from "./history-card"
import { LocalPanelCard } from "./local-panel-card"
import { LatestRunCard } from "./run-card"

/** The port the shop's backend was given (a setup run keeps it; later runs reuse it). */
const portOf = (state: ProvisioningState): number | null =>
  state.latest?.port ?? state.runs.find((run) => run.port !== null)?.port ?? null

/**
 * The shop's "Kurulum" tab (owner, operator; Ek C10, C11): the latest run
 * with its steps, live while it goes (every two seconds; not while the
 * browser tab is hidden or another tab of the page is open: the card is
 * not mounted then), the actions beside it, and every run below. When a
 * run ends the shop's page is read again: a setup makes it `active`.
 */
export function SetupTab({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const id = shop.tenant.id
  const query = useQuery(provisioningQuery(id))
  const state = query.data
  const status = state?.latest?.status
  const seen = useRef(status)
  useEffect(() => {
    if (seen.current === "running" && status !== undefined && status !== "running") {
      void client.invalidateQueries({ queryKey: tenantKey(id) })
    }
    seen.current = status
  }, [client, id, status])

  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!state) {
    return <Skeleton className="h-64 rounded-lg" />
  }
  const port = state.provisioner === "local" ? portOf(state) : null
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageGrid>
        <PageColumn span={8}>
          <LatestRunCard run={state.latest} />
        </PageColumn>
        <PageColumn span={4}>
          <ActionsCard tenantId={id} status={shop.tenant.status} state={state} />
          {port !== null ? <LocalPanelCard port={port} /> : null}
        </PageColumn>
      </PageGrid>
      {state.runs.length > 0 ? <HistoryCard tenantId={id} runs={state.runs} /> : null}
    </div>
  )
}
