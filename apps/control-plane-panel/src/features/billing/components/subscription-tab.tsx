import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { formatDate, formatDateTime } from "@qticaret/admin-ui/lib/format"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useMe } from "@/features/auth/api"
import { canSettle, subscriptionQuery } from "@/features/billing/api"
import type { Charge, Reminder, SubscriptionDetail } from "@/features/billing/api"
import { SUBSCRIPTION_TONES, chargeWord, money, periodText } from "@/features/billing/words"
import { errorText } from "@/lib/errors"
import { ChargeDialog } from "./charge-dialog"
import { Facts } from "./facts"
import { GraceDialog } from "./grace-dialog"

/** The subscription's terms and state, the grace in force; "Ek süreyi değiştir" for finance and the owner. */
function SubscriptionCard({ tenantId, detail }: { tenantId: string; detail: SubscriptionDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const [editing, setEditing] = useState(false)
  const sub = detail.subscription
  if (!sub) {
    return (
      <SectionCard title={t("billing.subscription.title")} className="h-full">
        <p className="text-sm text-muted-foreground">{t("billing.subscription.none")}</p>
      </SectionCard>
    )
  }
  const grace =
    sub.grace_days_override === null
      ? t("billing.subscription.graceDays", { count: sub.grace_days })
      : t("billing.subscription.graceOwn", {
          count: sub.grace_days_override,
          reason: sub.grace_override_reason ?? "",
        })
  return (
    <SectionCard
      title={t("billing.subscription.title")}
      className="h-full"
      action={
        canSettle(me?.role) ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(true)
            }}
          >
            {t("billing.grace.open")}
          </Button>
        ) : undefined
      }
    >
      <Facts
        rows={[
          [
            t("billing.subscription.status"),
            <StatusBadge tone={SUBSCRIPTION_TONES[sub.status]}>
              {t(`billing.subscriptionStatus.${sub.status}`)}
            </StatusBadge>,
          ],
          [t("billing.subscription.package"), sub.package?.name ?? "—"],
          [
            t("billing.subscription.price"),
            t("billing.subscription.priceEach", {
              amount: money(sub.price),
              period: t(`billing.period.${sub.period}`),
            }),
          ],
          [t("billing.subscription.started"), formatDate(sub.started_on)],
          ...(sub.trial_ends_on
            ? [
                [t("billing.subscription.trialEnds"), formatDate(sub.trial_ends_on)] as [
                  string,
                  string,
                ],
              ]
            : []),
          [
            t("billing.subscription.period"),
            periodText(sub.current_period_start, sub.current_period_end),
          ],
          [t("billing.subscription.grace"), grace],
          [t("billing.subscription.invoicing"), t(`billing.invoicing.${detail.invoicing}`)],
        ]}
      />
      {editing ? (
        <GraceDialog
          tenantId={tenantId}
          subscription={sub}
          onClose={() => {
            setEditing(false)
          }}
        />
      ) : null}
    </SectionCard>
  )
}

/** The charges, newest first; a row opens its window (facts and the actions). */
function ChargesCard({ tenantId, detail }: { tenantId: string; detail: SubscriptionDetail }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Charge | null>(null)
  const columns: Column<Charge>[] = [
    {
      key: "period",
      header: t("billing.charge.period"),
      cell: (row) => (
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            setOpen(row)
          }}
        >
          {periodText(row.period_start, row.period_end)}
        </button>
      ),
    },
    {
      key: "due",
      header: t("billing.charge.due"),
      cell: (row) => formatDate(row.due_on),
    },
    {
      key: "amount",
      header: t("billing.charge.amount"),
      align: "right",
      cell: (row) => money(row.amount, row.currency_code),
    },
    {
      key: "status",
      header: t("billing.charge.status"),
      cell: (row) => {
        const word = chargeWord(t, row)
        return <StatusBadge tone={word.tone}>{word.label}</StatusBadge>
      },
    },
  ]
  return (
    <SectionCard
      title={t("billing.charges.title")}
      description={t("billing.charges.text")}
      flush
      className="h-full"
    >
      <DataTable
        columns={columns}
        rows={detail.charges}
        rowKey={(row) => row.id}
        onRowClick={setOpen}
        empty={t("billing.charges.empty")}
      />
      {open ? (
        <ChargeDialog
          tenantId={tenantId}
          // The row as the list holds it now (after a change, the new one)
          charge={detail.charges.find((each) => each.id === open.id) ?? open}
          today={detail.today}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}

/** The reminders sent: kind, how it went, when; never to whom. */
function RemindersCard({ detail }: { detail: SubscriptionDetail }) {
  const { t } = useTranslation()
  const byCharge = new Map(detail.charges.map((charge) => [charge.id, charge]))
  const columns: Column<Reminder>[] = [
    {
      key: "kind",
      header: t("billing.reminders.kind"),
      cell: (row) => t(`billing.reminderKind.${row.kind}`),
    },
    {
      key: "charge",
      header: t("billing.reminders.charge"),
      className: "hidden md:table-cell",
      cell: (row) => {
        const charge = byCharge.get(row.charge_id)
        return charge ? formatDate(charge.due_on) : "—"
      },
    },
    {
      key: "outcome",
      header: t("billing.reminders.outcome"),
      cell: (row) =>
        row.outcome === "sent" || !row.error_code
          ? t(`billing.reminderOutcome.${row.outcome}`)
          : `${t(`billing.reminderOutcome.${row.outcome}`)} · ${t(`billing.reminderError.${row.error_code.replace("billing.", "")}`, { defaultValue: row.error_code })}`,
    },
    {
      key: "at",
      header: t("billing.reminders.at"),
      cell: (row) => formatDateTime(row.sent_at ?? row.created_at),
    },
  ]
  return (
    <SectionCard
      title={t("billing.reminders.title")}
      description={t("billing.reminders.text")}
      flush
    >
      <DataTable
        columns={columns}
        rows={detail.reminders}
        rowKey={(row) => row.id}
        empty={t("billing.reminders.empty")}
      />
    </SectionCard>
  )
}

/**
 * A shop's "Abonelik" tab (adr/0061 §7, Ek C16), every role's: its
 * charges on the left and the subscription's short facts on the right
 * (equal height), the reminders sent below.
 */
export function SubscriptionTab({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation()
  const query = useQuery(subscriptionQuery(tenantId))
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  const detail = query.data
  if (!detail) {
    return <Skeleton className="h-64 rounded-lg" />
  }
  return (
    <div className="flex flex-col gap-4">
      <PageGrid>
        <PageColumn span={8}>
          <ChargesCard tenantId={tenantId} detail={detail} />
        </PageColumn>
        <PageColumn span={4}>
          <SubscriptionCard tenantId={tenantId} detail={detail} />
        </PageColumn>
      </PageGrid>
      <RemindersCard detail={detail} />
    </div>
  )
}
