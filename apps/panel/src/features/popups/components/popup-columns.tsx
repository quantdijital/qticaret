import { Link } from "@tanstack/react-router"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { formatCount, formatDate } from "@qticaret/admin-ui/lib/format"
import type { Popup } from "@/features/popups/api/types"
import { ActiveSwitch } from "@/features/popups/components/active-switch"
import { PopupStateBadge } from "@/features/popups/components/popup-badges"

const P = "popups"

/** "12 Ara – 31 Ara", "12 Ara'dan", "31 Ara'ya kadar" or "Süresiz". */
export function datesText(t: TFunction, popup: Popup): string {
  const { starts_at: starts, ends_at: ends } = popup
  return starts && ends
    ? `${formatDate(starts)} – ${formatDate(ends)}`
    : starts
      ? t(`${P}.dates.from`, { date: formatDate(starts) })
      : ends
        ? t(`${P}.dates.until`, { date: formatDate(ends) })
        : t(`${P}.dates.open`)
}

/** The list's columns (adr/0080 S2): name, type, state, dates, counts, the switch. */
export function usePopupColumns(canWrite: boolean): Column<Popup>[] {
  const { t } = useTranslation()
  return [
    {
      key: "name",
      header: t(`${P}.columns.name`),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/popups/$id"
            params={{ id: row.id }}
            className="truncate font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {row.name}
          </Link>
          <span className="text-xs text-muted-foreground sm:hidden">
            {t(`${P}.types.${row.type}`)}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: t(`${P}.columns.type`),
      className: "hidden sm:table-cell",
      cell: (row) => <StatusBadge tone="neutral">{t(`${P}.types.${row.type}`)}</StatusBadge>,
    },
    {
      key: "state",
      header: t(`${P}.columns.state`),
      cell: (row) => <PopupStateBadge state={row.state} />,
    },
    {
      key: "dates",
      header: t(`${P}.columns.dates`),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">{datesText(t, row)}</span>
      ),
    },
    {
      key: "impressions",
      header: t(`${P}.counts.impressions`),
      align: "right",
      className: "hidden md:table-cell",
      cell: (row) => <span className="tabular-nums">{formatCount(row.counts.impressions)}</span>,
    },
    {
      key: "clicks",
      header: t(`${P}.counts.clicks`),
      align: "right",
      className: "hidden md:table-cell",
      cell: (row) => <span className="tabular-nums">{formatCount(row.counts.clicks)}</span>,
    },
    {
      key: "signups",
      header: t(`${P}.counts.signups`),
      align: "right",
      className: "hidden xl:table-cell",
      cell: (row) =>
        row.type === "newsletter" ? (
          <span className="tabular-nums">{formatCount(row.counts.signups)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "active",
      header: <span className="sr-only">{t(`${P}.columns.active`)}</span>,
      align: "right",
      cell: (row) => <ActiveSwitch popup={row} disabled={!canWrite} />,
    },
  ]
}
