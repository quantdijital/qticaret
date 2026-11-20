import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useUpdateCategory } from "@/features/categories/api/categories"
import type { Category } from "@/features/categories/api/categories"
import { categoryImagesQuery } from "@/features/categories/api/images"
import {
  ancestorHandles,
  ancestorNames,
  matchingCategories,
  siblingFor,
  treeRows,
} from "@/features/categories/tree"
import { useCategoryPathPrefix } from "@/features/categories/use-category-path"
import { errorText } from "@/lib/errors"
import { CategoryThumb } from "./category-thumb"

interface Row {
  category: Category
  depth: number
  hasChildren: boolean
  /** While searching: the parents' names, the row standing alone. */
  parents: string[] | null
}

interface CategoryTableProps {
  categories: Category[] | undefined
  loading: boolean
  /** The search's words; with them the list is flat, each row naming its parents. */
  query: string
  empty: ReactNode
}

/**
 * The shop's categories as a list (brands' look, docs/06 §4): parents
 * first with their children indented under them, branches open and close,
 * arrows move a category within its level; a search lists the matches
 * flat with each one's parents. A row opens the category's page.
 */
export function CategoryTable({ categories, loading, query, empty }: CategoryTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const prefix = useCategoryPathPrefix()
  const images = useQuery(categoryImagesQuery())
  const update = useUpdateCategory()
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const all = categories ?? []
  const searching = query.trim() !== ""
  const rows: Row[] | undefined = !categories
    ? undefined
    : searching
      ? matchingCategories(all, query).map((category) => ({
          category,
          depth: 0,
          hasChildren: false,
          parents: ancestorNames(all, category),
        }))
      : treeRows(all, collapsed).map((row) => ({ ...row, parents: null }))

  const toggle = (id: string) => {
    setCollapsed((was) => {
      const next = new Set(was)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  // Taking the sibling's place; Medusa moves the others along
  const move = (category: Category, step: -1 | 1) => {
    const sibling = siblingFor(all, category, step)
    if (sibling) {
      update.mutate(
        { id: category.id, rank: sibling.rank ?? 0 },
        { onError: (failure) => toast.error(errorText(t, failure)) }
      )
    }
  }

  const columns: Column<Row>[] = [
    {
      key: "category",
      header: t("categories.columns.category"),
      cell: ({ category, depth, hasChildren, parents }) => {
        const open = !collapsed.has(category.id)
        const path = [
          ...ancestorHandles(all, category.parent_category_id ?? null),
          category.handle,
        ].join("/")
        return (
          <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 24 }}>
            {parents ? null : (
              <button
                type="button"
                aria-label={t(open ? "categories.collapse" : "categories.expand", {
                  name: category.name,
                })}
                aria-expanded={hasChildren ? open : undefined}
                disabled={!hasChildren}
                onClick={(event) => {
                  event.stopPropagation()
                  toggle(category.id)
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:invisible"
              >
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            )}
            <CategoryThumb url={images.data?.get(category.id)?.url ?? null} />
            <div className="ml-1 flex min-w-0 flex-col">
              <Link
                to="/categories/$id"
                params={{ id: category.id }}
                className="truncate font-medium hover:underline"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                {category.name}
              </Link>
              {parents ? (
                <span className="truncate text-xs text-muted-foreground">
                  {parents.length > 0 ? parents.join(" › ") : t("categories.topLevel")}
                </span>
              ) : (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {prefix}
                  {path}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: "status",
      header: t("categories.columns.status"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: ({ category }) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {category.is_internal ? (
            <StatusBadge tone="neutral">{t("categories.internal")}</StatusBadge>
          ) : null}
          <StatusBadge tone={category.is_active ? "success" : "neutral"}>
            {t(category.is_active ? "categories.active" : "categories.inactive")}
          </StatusBadge>
        </div>
      ),
    },
  ]
  if (!searching) {
    columns.push({
      key: "order",
      header: t("categories.columns.order"),
      align: "right",
      className: "w-24",
      cell: ({ category }) => (
        // A click beside a disabled arrow stays in the cell, not opening the row
        <div
          className="flex justify-end"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {([-1, 1] as const).map((step) => (
            <Button
              key={step}
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={update.isPending || !siblingFor(all, category, step)}
              aria-label={t(step < 0 ? "categories.moveUp" : "categories.moveDown", {
                name: category.name,
              })}
              onClick={(event) => {
                event.stopPropagation()
                move(category, step)
              }}
            >
              {step < 0 ? <ChevronUp /> : <ChevronDown />}
            </Button>
          ))}
        </div>
      ),
    })
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.category.id}
      loading={loading}
      onRowClick={(row) => {
        void navigate({ to: "/categories/$id", params: { id: row.category.id } })
      }}
      empty={empty}
    />
  )
}
