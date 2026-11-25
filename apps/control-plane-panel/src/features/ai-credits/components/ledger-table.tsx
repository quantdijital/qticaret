import { useTranslation } from "react-i18next"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { useMe } from "@/features/auth/api"
import { LEDGER_PAGE_SIZE } from "@/features/ai-credits/api/queries"
import type { AiLedgerEntry, AiWallet } from "@/features/ai-credits/api/schemas"
import { actorText, kindText, signed } from "@/features/ai-credits/words"

/**
 * The ledger, newest first, a page at a time (adr/0085 §1): when, what,
 * the credits in or out of which bucket, the note and who. On a phone the
 * note and who go under the kind, so the table never scrolls sideways.
 */
export function LedgerTable({
  wallet,
  loading,
  stale,
  page,
  onPage,
}: {
  wallet: AiWallet | undefined
  loading: boolean
  stale: boolean
  page: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  const me = useMe()
  const columns: Column<AiLedgerEntry>[] = [
    {
      key: "at",
      header: t("aiCredits.ledger.columns.at"),
      className: "whitespace-nowrap",
      cell: (row) => formatDateTime(row.created_at),
    },
    {
      key: "kind",
      header: t("aiCredits.ledger.columns.kind"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span>{kindText(t, row.kind)}</span>
          <span className="text-xs text-muted-foreground">
            {t(`aiCredits.buckets.${row.bucket}`)}
          </span>
          {row.note ? (
            <span className="text-xs break-words text-muted-foreground md:hidden">{row.note}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: t("aiCredits.ledger.columns.amount"),
      align: "right",
      className: "tabular-nums whitespace-nowrap",
      cell: (row) => (
        <span className={row.amount > 0 ? "text-success-text" : undefined}>
          {signed(row.amount)}
        </span>
      ),
    },
    {
      key: "note",
      header: t("aiCredits.ledger.columns.note"),
      className: "hidden md:table-cell",
      cell: (row) => <span className="break-words">{row.note ?? "—"}</span>,
    },
    {
      key: "actor",
      header: t("aiCredits.ledger.columns.actor"),
      className: "hidden lg:table-cell",
      cell: (row) => <span className="break-all">{actorText(t, row.actor, me)}</span>,
    },
  ]
  return (
    <>
      <DataTable
        columns={columns}
        rows={wallet?.entries}
        rowKey={(row) => row.id}
        loading={loading}
        stale={stale}
        empty={t("aiCredits.ledger.empty")}
      />
      <Pagination
        page={page}
        pageSize={LEDGER_PAGE_SIZE}
        count={wallet?.count ?? 0}
        onPageChange={onPage}
      />
    </>
  )
}
