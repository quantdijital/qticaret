import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { legalOverviewQuery } from "@/features/legal/api"
import type { LegalKind, LegalOverviewRow } from "@/features/legal/api"
import { LegalStatus } from "@/features/legal/components/legal-status"
import { errorText } from "@/lib/errors"

const L = "settings.legal"

// Read as a few groups: what an order is made under, the shop's policies, the rest
const GROUPS: { key: string; kinds: LegalKind[] }[] = [
  { key: "order", kinds: ["distance_sales", "pre_information"] },
  { key: "policies", kinds: ["return_policy", "shipping_policy", "cookie_policy"] },
  { key: "people", kinds: ["privacy_notice", "membership"] },
]

function Row({ row }: { row: LegalOverviewRow }) {
  const { t } = useTranslation()
  const nameId = `legal-${row.kind}`
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-5 py-4">
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
        <span id={nameId} className="text-sm font-medium">
          {t(`${L}.kinds.${row.kind}.name`)}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {t(`${L}.kinds.${row.kind}.description`)}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <LegalStatus published={row.published} draft={row.draft} />
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/legal/$kind" params={{ kind: row.kind }} aria-describedby={nameId}>
            {t(`${L}.open`)}
          </Link>
        </Button>
      </div>
    </li>
  )
}

/**
 * Settings > Legal texts (F13.1, adr/0041): each text the shop shows its
 * customers, whether it is published and whether a draft waits.
 */
export function LegalListPage() {
  const { t } = useTranslation()
  const query = useQuery(legalOverviewQuery())
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${L}.title`)} description={t(`${L}.subtitle`)} />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={4} />
      ) : (
        GROUPS.map((group) => (
          <SectionCard
            key={group.key}
            title={t(`${L}.groups.${group.key}.title`)}
            description={t(`${L}.groups.${group.key}.description`)}
            flush
          >
            <ul>
              {group.kinds.map((kind) => {
                const row = query.data.find((each) => each.kind === kind)
                return row ? <Row key={kind} row={row} /> : null
              })}
            </ul>
          </SectionCard>
        ))
      )}
    </div>
  )
}
