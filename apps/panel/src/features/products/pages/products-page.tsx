import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { PackageOpen, Plus, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import { FilterBar } from "@qticaret/admin-ui/patterns/filter-bar"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { BulkAction } from "@/features/products/api/bulk"
import { productCountsQuery, productsQuery } from "@/features/products/api/products"
import { ListOptions } from "@/features/products/components/list-options"
import { useListPrefs } from "@/features/products/list-prefs"
import { QuickSave, QuickToggle } from "@/features/products/quick-edit/quick-save"
import { useQuickEdit } from "@/features/products/quick-edit/use-quick-edit"
import type { ProductFilters } from "@/features/products/api/products"
import { PLAN_STRIP_ID } from "@/components/layout/plan-status-banner"
import { usePlanRestricted } from "@/features/auth/api/staff"
import { BulkBar } from "@/features/products/bulk/bulk-bar"
import { BulkEditDialog } from "@/features/products/bulk/bulk-edit-dialog"
import { FactsDialog } from "@/features/attributes/facts/facts-dialog"
import { useProductColumns } from "@/features/products/components/product-columns"
import { useProductFilters } from "@/features/products/components/product-filters"
import { ProductSort } from "@/features/products/components/product-sort"
import type { FilterValues } from "@/features/products/components/product-filters"
import { useDuplicateAndOpen } from "@/features/products/use-duplicate"
import { SampleOffer } from "@/features/sample-catalog/sample-offer"
import { SheetExportMenu } from "@/features/products/components/sheet-export-menu"
import { SheetImportDialog } from "@/features/products/components/sheet-import-dialog"
import { productScoresQuery } from "@/features/seo/api/advisor"
import { useLimitStanding } from "@/features/settings/api/plan"
import { LimitNotice } from "@/features/settings/components/limit-notice"
import { isFull } from "@/features/settings/plan-rules"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/products/")

// The product limit's notice, which the disabled add button points to
const LIMIT_NOTICE = "products-limit-notice"

/** Every product with its picture, status, stock and price; search and quick views above. */
export function ProductsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const status = search.status ?? "all"
  const page = (search.page ?? 1) - 1
  const q = search.q ?? ""
  const values: FilterValues = {
    category: search.category,
    brand: search.brand,
    stock: search.stock,
    missing: search.missing,
    kind: search.kind,
    sort: search.sort,
  }
  const filters: ProductFilters = { q, status, ...values }
  // "Görünüm": products per page and the columns shown, kept per person
  const [prefs, setPrefs] = useListPrefs()
  const list = useQuery(productsQuery({ ...filters, page, pageSize: prefs.pageSize }))
  const counts = useQuery(productCountsQuery())
  const scores = useQuery(
    productScoresQuery((list.data?.products ?? []).map((product) => product.id))
  )
  const duplicate = useDuplicateAndOpen()
  const productsFull = isFull(useLimitStanding("products"))
  const restricted = usePlanRestricted()
  // "Hızlı düzenle": price, stock and status typed in the list, saved from the header
  const quick = useQuickEdit()
  const columns = useProductColumns(
    new Map((scores.data ?? []).map((score) => [score.entity_id, score])),
    (product) => {
      duplicate.run(product.id)
    },
    prefs.hidden,
    quick
  )
  const quickDirty = quick.count > 0 || quick.saving
  // A search or a filter that can leave products out: the empty list says "no match"
  const filtered =
    q !== "" ||
    Boolean(values.category ?? values.brand ?? values.stock ?? values.missing ?? values.kind)
  const [importing, setImporting] = useState(false)
  // Picks stay across pages and searches until a bulk change is made or they are let go
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  // The products whose descriptions' facts are being brought over; none while closed
  const [factsFor, setFactsFor] = useState<string[]>([])
  // A change of search, view or filter starts from the first page
  const setSearch = (
    next: { q?: string; status?: typeof status; page?: number } & Partial<FilterValues>
  ) => {
    const merged = { ...values, ...next }
    void navigate({
      to: "/products",
      search: {
        q: (next.q ?? q) || undefined,
        status: (next.status ?? status) === "all" ? undefined : (next.status ?? status),
        page: next.page && next.page > 1 ? next.page : undefined,
        category: merged.category,
        brand: merged.brand,
        stock: merged.stock,
        missing: merged.missing,
        kind: merged.kind,
        sort: merged.sort,
      },
      replace: true,
    })
  }
  const filterBar = useProductFilters(values, (next) => {
    setSearch({ ...next, page: 1 })
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.products")}
        description={t("products.description")}
        action={
          // While quick edits wait, the header holds their save alone (as the product page's)
          quickDirty ? (
            <QuickSave edit={quick} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <SheetExportMenu />
              <Button
                variant="outline"
                onClick={() => {
                  setImporting(true)
                }}
              >
                <Upload />
                {t("products.sheets.import")}
              </Button>
              {productsFull || restricted ? (
                // At the package's limit the notice below says why (adr/0061 Ek C14); while the
                // shop is restricted or suspended, the strip above every page (Ek C15)
                <Button
                  disabled
                  title={t(restricted ? "plan.strip.closed" : "plan.createBlocked")}
                  aria-describedby={restricted ? PLAN_STRIP_ID : LIMIT_NOTICE}
                >
                  <Plus />
                  {t("products.add")}
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/products/new">
                    <Plus />
                    {t("products.add")}
                  </Link>
                </Button>
              )}
            </div>
          )
        }
      />
      <LimitNotice limit="products" id={LIMIT_NOTICE} />
      <SheetImportDialog open={importing} onOpenChange={setImporting} />
      <BulkEditDialog
        action={bulkAction}
        productIds={[...selected]}
        onClose={() => {
          setBulkAction(null)
        }}
        onDone={() => {
          setSelected(new Set())
        }}
      />
      <FactsDialog
        productIds={factsFor}
        onClose={() => {
          setFactsFor([])
        }}
        onDone={() => {
          setSelected(new Set())
        }}
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("products.views")}
          value={status}
          onChange={(next) => {
            setSearch({ status: next, page: 1 })
          }}
          tabs={[
            { key: "all", label: t("products.tabs.all"), count: counts.data?.all },
            {
              key: "published",
              label: t("products.tabs.published"),
              count: counts.data?.published,
            },
            { key: "draft", label: t("products.tabs.draft"), count: counts.data?.draft },
          ]}
        />
        <FilterBar
          className="px-5 py-3"
          {...filterBar}
          search={
            <SearchInput
              className="sm:max-w-none"
              value={q}
              placeholder={t("products.search")}
              onChange={(text) => {
                setSearch({ q: text, page: 1 })
              }}
            />
          }
          actions={
            <div className="flex items-center gap-2">
              <ProductSort
                value={values.sort}
                onChange={(sort) => {
                  setSearch({ sort, page: 1 })
                }}
              />
              <QuickToggle edit={quick} />
              <ListOptions
                value={prefs}
                onChange={(next) => {
                  // Another page size starts from the first page
                  if (next.pageSize !== prefs.pageSize) {
                    setSearch({ page: 1 })
                  }
                  setPrefs(next)
                }}
              />
            </div>
          }
          note={
            list.data?.limited ? (
              <p className="text-xs text-muted-foreground">{t("products.filters.limited")}</p>
            ) : null
          }
        />
        {selected.size > 0 ? (
          <BulkBar
            selected={selected}
            onSelect={setSelected}
            filters={filters}
            total={list.data?.count ?? 0}
            onAction={setBulkAction}
            onFacts={() => {
              setFactsFor([...selected])
            }}
          />
        ) : null}
        {list.isError ? (
          <div className="px-5 pb-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.products}
              rowKey={(product) => product.id}
              loading={list.isPending}
              stale={list.isPlaceholderData}
              selection={{
                selected,
                onChange: setSelected,
                rowLabel: (product) => product.title,
              }}
              onRowClick={(product) => {
                void navigate({ to: "/products/$id", params: { id: product.id } })
              }}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <PackageOpen className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {filtered ? t("products.noMatch") : t("products.empty")}
                  </p>
                  {filtered ? null : (
                    <Button asChild size="sm">
                      <Link to="/products/new">
                        <Plus />
                        {t("products.add")}
                      </Link>
                    </Button>
                  )}
                  {filtered ? null : <SampleOffer />}
                </div>
              }
            />
            {list.data && list.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={prefs.pageSize}
                count={list.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
