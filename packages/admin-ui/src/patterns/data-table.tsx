import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Checkbox } from "../ui/checkbox"
import { Skeleton } from "../ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { cn } from "../lib/utils"

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Right-aligned for amounts and counts. */
  align?: "left" | "right"
  /** Hidden below a width, e.g. "hidden md:table-cell". */
  className?: string
}

/** Rows picked for a bulk action; they stay picked across pages. */
export interface RowSelection<T> {
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  /** What a row's checkbox is called for screen readers (its record's name). */
  rowLabel: (row: T) => string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  /** The whole row opens the record; the primary cell carries a real link for keyboards. */
  onRowClick?: (row: T) => void
  loading?: boolean
  empty: ReactNode
  /** Dimmed while the next page loads (the frame stays). */
  stale?: boolean
  /** A checkbox per row, and one for the page, in a first column. */
  selection?: RowSelection<T>
}

function PageCheckbox<T>({
  rows,
  rowKey,
  selection,
}: {
  rows: T[]
  rowKey: (row: T) => string
  selection: RowSelection<T>
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const keys = rows.map(rowKey)
  const picked = keys.filter((key) => selection.selected.has(key)).length
  return (
    <Checkbox
      aria-label={t("list.selectPage")}
      disabled={keys.length === 0}
      checked={picked === 0 ? false : picked === keys.length ? true : "indeterminate"}
      onCheckedChange={(checked) => {
        const next = new Set(selection.selected)
        for (const key of keys) {
          if (checked === true) {
            next.add(key)
          } else {
            next.delete(key)
          }
        }
        selection.onChange(next)
      }}
    />
  )
}

function RowCheckbox<T>({
  row,
  rowKey,
  selection,
}: {
  row: T
  rowKey: (row: T) => string
  selection: RowSelection<T>
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const key = rowKey(row)
  return (
    <Checkbox
      aria-label={t("list.selectRow", { name: selection.rowLabel(row) })}
      checked={selection.selected.has(key)}
      // The row opens its record; the box only picks it
      onClick={(event) => {
        event.stopPropagation()
      }}
      onCheckedChange={(checked) => {
        const next = new Set(selection.selected)
        if (checked === true) {
          next.add(key)
        } else {
          next.delete(key)
        }
        selection.onChange(next)
      }}
    />
  )
}

/**
 * A list of records (docs/18 §7 DataTable): sticky header, comfortable rows
 * from the density token, right-aligned numbers, skeleton rows while
 * loading and an empty state. Paging, search and filters live above it.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  empty,
  stale,
  selection,
}: DataTableProps<T>) {
  const align = (column: Column<T>) => (column.align === "right" ? "text-right" : "")
  // With checkboxes, they take the first column's inset
  const pad = (index: number) =>
    index === 0 && !selection ? "pl-5" : index === columns.length - 1 ? "pr-5" : ""
  const boxCell = "w-10 pr-0 pl-5"
  return (
    <div className={cn("transition-opacity", stale && "opacity-60")}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            {selection ? (
              <TableHead className={boxCell}>
                <PageCheckbox rows={rows ?? []} rowKey={rowKey} selection={selection} />
              </TableHead>
            ) : null}
            {columns.map((column, index) => (
              <TableHead
                key={column.key}
                className={cn(
                  "h-10 text-xs font-medium text-muted-foreground",
                  align(column),
                  pad(index),
                  column.className
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 8 }, (_, row) => (
                <TableRow key={row}>
                  {selection ? <TableCell className={boxCell} /> : null}
                  {columns.map((column, index) => (
                    <TableCell key={column.key} className={cn(pad(index), column.className)}>
                      <Skeleton className="h-5 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows?.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={
                    onRowClick
                      ? () => {
                          onRowClick(row)
                        }
                      : undefined
                  }
                  data-state={selection?.selected.has(rowKey(row)) ? "selected" : undefined}
                  className={cn("h-[var(--row-height)]", onRowClick && "cursor-pointer")}
                >
                  {selection ? (
                    <TableCell className={boxCell}>
                      <RowCheckbox row={row} rowKey={rowKey} selection={selection} />
                    </TableCell>
                  ) : null}
                  {columns.map((column, index) => (
                    <TableCell
                      key={column.key}
                      className={cn(align(column), pad(index), column.className)}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!loading && rows?.length === 0 ? <div className="border-t px-5 py-12">{empty}</div> : null}
    </div>
  )
}
