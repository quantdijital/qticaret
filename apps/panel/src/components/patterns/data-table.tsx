import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Right-aligned for amounts and counts. */
  align?: "left" | "right"
  /** Hidden below a width, e.g. "hidden md:table-cell". */
  className?: string
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
}: DataTableProps<T>) {
  const align = (column: Column<T>) => (column.align === "right" ? "text-right" : "")
  const pad = (index: number) => (index === 0 ? "pl-5" : index === columns.length - 1 ? "pr-5" : "")
  return (
    <div className={cn("transition-opacity", stale && "opacity-60")}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
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
                  className={cn("h-[var(--row-height)]", onRowClick && "cursor-pointer")}
                >
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
