import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import type { PlanDocumentState } from "@/features/tenants/api"

/**
 * What the shop was last told (adr/0061 Ek C9): the plan document's
 * serial and time, whether its push reached the shop, and when the shop
 * last pulled. Owner and operator only (the API leaves it out for others).
 */
export function DocumentCard({ state }: { state: PlanDocumentState }) {
  const { t } = useTranslation()
  const when = (value: string | null | undefined) => (value ? formatDateTime(value) : "—")
  const rows: [string, string][] = state.issued
    ? [
        [t("planDocument.serial"), String(state.serial ?? "—")],
        [t("planDocument.issuedAt"), when(state.issued_at)],
        [
          t("planDocument.push"),
          state.push_status
            ? t(`planDocument.pushStatus.${state.push_status}`) +
              (state.push_error ? ` (${state.push_error})` : "")
            : "—",
        ],
        [t("planDocument.pushedAt"), when(state.pushed_at)],
        [t("planDocument.pulledAt"), when(state.pulled_at)],
      ]
    : []
  return (
    <SectionCard
      title={t("planDocument.title")}
      description={state.issued ? t("planDocument.text") : t("planDocument.none")}
    >
      {state.issued ? (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </SectionCard>
  )
}
