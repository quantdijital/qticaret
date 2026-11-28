import { useInfiniteQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDate, formatDateTime } from "@qticaret/admin-ui/lib/format"
import { fetchActivity, tenantKey } from "@/features/tenants/api"
import type { ActivityItem } from "@/features/tenants/api"
import { money } from "@/features/billing/words"
import { errorText } from "@/lib/errors"

const T = "/admin/cp/tenants/:id"

/** The audit row's route, as one line of the shop's history (`activity.actions.<name>`). */
const ACTIONS: Record<string, string> = {
  [`POST ${T}`]: "renamed",
  [`POST ${T}/company`]: "company",
  [`POST ${T}/reveal-tckn`]: "tckn",
  // adr/0061 Ek 2026-11-28: a grant into the shop's panel (its reason is the note beside it)
  [`POST ${T}/support-grants`]: "supportGrant",
  [`POST ${T}/contacts`]: "contactAdded",
  [`POST ${T}/contacts/:contact_id`]: "contactChanged",
  [`DELETE ${T}/contacts/:contact_id`]: "contactRemoved",
  [`POST ${T}/domains`]: "domainAdded",
  [`DELETE ${T}/domains/:domain_id`]: "domainRemoved",
  [`POST ${T}/domains/:domain_id/primary`]: "domainPrimary",
  [`POST ${T}/notes`]: "noteAdded",
  [`POST ${T}/notes/:note_id`]: "noteChanged",
  [`DELETE ${T}/notes/:note_id`]: "noteRemoved",
  [`POST ${T}/plan`]: "plan",
  [`POST ${T}/overrides`]: "override",
  [`DELETE ${T}/overrides/:key`]: "overrideRemoved",
  // Ek C16: what staff did to its payments
  [`POST ${T}/charges/:charge_id/pay`]: "chargePaid",
  [`POST ${T}/charges/:charge_id/waive`]: "chargeWaived",
  [`POST ${T}/charges/:charge_id/void`]: "chargeVoided",
  [`POST ${T}/charges/:charge_id/amount`]: "chargeAmount",
  [`POST ${T}/subscription`]: "grace",
}

/** A recorded value as text: a name or a code, else a dash. */
const textOf = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "—"

/** What a recorded `{ from, to }` says, where it says something a person reads. */
function detailOf(t: TFunction, item: ActivityItem): string | null {
  const changes = item.changes ?? {}
  const pair = (value: unknown) => value as { from?: unknown; to?: unknown } | undefined
  const name = pair(changes["name"])
  if (name?.to !== undefined) {
    return t("activity.fromTo", { from: textOf(name.from), to: textOf(name.to) })
  }
  const plan = pair(changes["package"])
  if (plan) {
    return t("activity.fromTo", {
      from: plan.from === null ? t("tenants.noPackage") : textOf(plan.from),
      to: plan.to === null ? t("tenants.noPackage") : textOf(plan.to),
    })
  }
  const own = changes["override"] as { key?: string } | undefined
  if (own?.key) {
    return t(`limits.keys.${own.key}`)
  }
  // Ek C16: a payment's amount from and to (kuruş), else the charge's due day
  const amount = pair(changes["amount"])
  if (typeof amount?.from === "number" && typeof amount.to === "number") {
    return t("activity.fromTo", { from: money(amount.from), to: money(amount.to) })
  }
  const charge = changes["charge"] as { due_on?: unknown } | undefined
  if (typeof charge?.due_on === "string") {
    return formatDate(charge.due_on)
  }
  const domain = pair(changes["domain"]) ?? pair(changes["primary_domain"])
  const host = domain?.to ?? domain?.from
  return typeof host === "string" ? host : null
}

function lineOf(t: TFunction, item: ActivityItem): string {
  if (item.kind === "status") {
    return item.from_status
      ? t("activity.status", {
          from: t(`tenants.status.${item.from_status}`),
          to: t(`tenants.status.${item.to_status ?? "active"}`),
        })
      : t("activity.created")
  }
  const action = ACTIONS[item.action ?? ""]
  return t(action ? `activity.actions.${action}` : "activity.actions.other")
}

/**
 * What happened to the shop, newest first (adr/0061 §2): its status
 * changes and every change staff made, with who; the reason of a status
 * move. Payments and setup runs join with C16 and C10.
 */
export function ActivityCard({ id }: { id: string }) {
  const { t } = useTranslation()
  const query = useInfiniteQuery({
    queryKey: [...tenantKey(id), "activity"],
    queryFn: ({ pageParam }) => fetchActivity(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_before,
  })
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <SectionCard title={t("activity.title")} description={t("activity.text")} flush>
      {query.isError ? (
        <div className="px-5 pb-5">
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : query.isPending ? (
        <LoadingRows />
      ) : items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{t("activity.empty")}</p>
      ) : (
        <ol className="flex flex-col">
          {items.map((item) => {
            const detail = item.kind === "action" ? detailOf(t, item) : null
            return (
              <li
                key={item.id}
                className="flex flex-col gap-0.5 border-t px-5 py-3 sm:flex-row sm:gap-4"
              >
                <time
                  dateTime={item.at}
                  className="w-36 shrink-0 text-[13px] text-muted-foreground tabular-nums"
                >
                  {formatDateTime(item.at)}
                </time>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm">
                    {lineOf(t, item)}
                    {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.actor ?? t("activity.system")}
                    {item.reason_code
                      ? ` · ${t(`activity.reasons.${item.reason_code}`, { defaultValue: item.reason_code })}`
                      : ""}
                  </span>
                  {item.note ? (
                    // A suspension's or its end's reason, in the staff member's words (Ek C15)
                    <span className="text-xs text-muted-foreground break-words">“{item.note}”</span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {query.hasNextPage ? (
        <div className="border-t px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t("activity.more")}
          </Button>
        </div>
      ) : null}
    </SectionCard>
  )
}
