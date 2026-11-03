import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SynonymGroup } from "@/features/seo/api/synonyms"
import { formatDate, formatDateTime } from "@/lib/format"

const S = "seo.siteSearch"

/** A group's terms side by side, as search treats them: any one finds the others. */
export function TermChips({ terms }: { terms: readonly string[] }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5 py-1">
      {terms.map((term) => (
        <li
          key={term}
          className="max-w-full truncate rounded-md bg-accent px-2 py-0.5 text-[13px] text-accent-foreground"
        >
          {term}
        </li>
      ))}
    </ul>
  )
}

function RowActions({
  group,
  onEdit,
  onDelete,
}: {
  group: SynonymGroup
  onEdit: (group: SynonymGroup) => void
  onDelete: (group: SynonymGroup) => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t(`${S}.rowActions`, { terms: group.terms.join(", ") })}
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            onEdit(group)
          }}
        >
          <Pencil />
          {t("common.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onDelete(group)
          }}
        >
          <Trash2 />
          {t("common.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface SynonymsTableProps {
  rows: SynonymGroup[] | undefined
  loading: boolean
  stale: boolean
  empty: ReactNode
  /** Changing and deleting; none for a role that only reads. */
  actions?: { onEdit: (group: SynonymGroup) => void; onDelete: (group: SynonymGroup) => void }
}

/** The shop's synonym groups: their terms and when each last changed. */
export function SynonymsTable({ rows, loading, stale, empty, actions }: SynonymsTableProps) {
  const { t } = useTranslation()
  const columns: Column<SynonymGroup>[] = [
    {
      key: "terms",
      header: t(`${S}.columns.terms`),
      cell: (group) => <TermChips terms={group.terms} />,
    },
    {
      key: "updated",
      header: t(`${S}.columns.updated`),
      align: "right",
      className: "hidden w-40 sm:table-cell",
      cell: (group) => (
        <time
          dateTime={group.updated_at}
          title={formatDateTime(group.updated_at)}
          className="whitespace-nowrap text-muted-foreground tabular-nums"
        >
          {formatDate(group.updated_at)}
        </time>
      ),
    },
  ]
  if (actions) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      align: "right",
      className: "w-14",
      cell: (group) => (
        <RowActions group={group} onEdit={actions.onEdit} onDelete={actions.onDelete} />
      ),
    })
  }
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(group) => group.id}
      loading={loading}
      stale={stale}
      empty={empty}
      {...(actions ? { onRowClick: actions.onEdit } : {})}
    />
  )
}
