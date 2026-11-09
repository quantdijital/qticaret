import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Layers, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { COLLECTION_PAGE_SIZE, collectionsQuery } from "@/features/collections/api/collections"
import type { Collection } from "@/features/collections/api/collections"
import { NewCollectionDialog } from "@/features/collections/components/new-collection-dialog"
import { COLLECTION_PATH_PREFIX } from "@/features/collections/paths"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

const route = getRouteApi("/_auth/collections/")

function useColumns(): Column<Collection>[] {
  const { t } = useTranslation()
  return [
    {
      key: "collection",
      header: t("collections.columns.collection"),
      cell: (collection) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={collection.image?.url} />
          <div className="flex min-w-0 flex-col">
            <Link
              to="/collections/$id"
              params={{ id: collection.id }}
              className="truncate font-medium hover:underline"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              {collection.title}
            </Link>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {COLLECTION_PATH_PREFIX}
              {collection.handle}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "products",
      header: t("collections.columns.products"),
      align: "right",
      cell: (collection) => (
        <span className="tabular-nums">{formatCount(collection.product_count)}</span>
      ),
    },
    {
      key: "status",
      header: t("collections.columns.status"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (collection) => (
        <StatusBadge tone={collection.is_active ? "success" : "neutral"}>
          {t(collection.is_active ? "collections.active" : "collections.inactive")}
        </StatusBadge>
      ),
    },
  ]
}

/** Ürünler > Koleksiyonlar: each with its page, picture and products. */
export function CollectionsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const list = useQuery(collectionsQuery({ q, page }))
  const columns = useColumns()
  const [adding, setAdding] = useState(false)
  const setSearch = (next: { q?: string; page?: number }) => {
    void navigate({
      to: "/collections",
      search: (previous: { q?: string | undefined; page?: number | undefined }) => {
        const merged = { ...previous, ...next }
        return {
          q: merged.q === "" ? undefined : merged.q,
          page: merged.page && merged.page > 1 ? merged.page : undefined,
        }
      },
      replace: true,
    })
  }
  const add = (
    <Button
      onClick={() => {
        setAdding(true)
      }}
    >
      <Plus />
      {t("collections.add")}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.collections")}
        description={t("collections.description")}
        action={add}
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("collections.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
        </div>
        {list.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={list.data?.collections}
            rowKey={(collection) => collection.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            onRowClick={(collection) => {
              void navigate({ to: "/collections/$id", params: { id: collection.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <Layers className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  {q ? t("collections.noMatch") : t("collections.empty")}
                </p>
                {q ? null : add}
              </div>
            }
          />
        )}
        {list.data && list.data.count > COLLECTION_PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={COLLECTION_PAGE_SIZE}
            count={list.data.count}
            onPageChange={(next) => {
              setSearch({ page: next + 1 })
            }}
          />
        ) : null}
      </section>
      <NewCollectionDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
