import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Link2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { LINK_PAGE_SIZE, paymentLinksQuery } from "@/features/payment-links/api/payment-links"
import { LINK_STATUSES } from "@/features/payment-links/api/types"
import type { LinkStatus } from "@/features/payment-links/api/types"
import { useLinkColumns } from "@/features/payment-links/components/link-columns"
import { LinkFilters } from "@/features/payment-links/components/link-filters"
import { LinkGate } from "@/features/payment-links/components/link-gate"
import { useLinkAccess } from "@/features/payment-links/components/use-link-access"
import type { PaymentLinkSearch } from "@/features/payment-links/search"
import { errorText } from "@/lib/errors"

const P = "paymentLinks"
const route = getRouteApi("/_auth/payment-links/")

type StatusView = LinkStatus | "all"

/** The links, newest first; the state, the discount and the maker filtered by the server. */
function LinkList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = route.useSearch()
  const status: StatusView = search.status ?? "all"
  const page = (search.page ?? 1) - 1
  const list = useQuery(
    paymentLinksQuery({
      status: status === "all" ? null : status,
      discounted: search.discounted === undefined ? null : search.discounted === "true",
      createdBy: search.created_by ?? null,
      page,
    })
  )
  const columns = useLinkColumns()
  const setSearch = (
    next: Omit<Partial<PaymentLinkSearch>, "status"> & { status?: StatusView }
  ) => {
    const merged = { ...search, ...next }
    void navigate({
      to: "/payment-links",
      search: {
        status: merged.status === "all" ? undefined : merged.status,
        discounted: merged.discounted,
        created_by: merged.created_by,
        page: merged.page && merged.page > 1 ? merged.page : undefined,
      },
      replace: true,
    })
  }
  const filtered =
    status !== "all" || search.discounted !== undefined || search.created_by !== undefined
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 border-b">
        {/* The tabs' own line gives way to the row's */}
        <div className="min-w-0 flex-1 [&>[role=tablist]]:border-b-0">
          <FilterTabs
            label={t(`${P}.views`)}
            value={status}
            onChange={(next) => {
              setSearch({ status: next, page: 1 })
            }}
            tabs={(["all", ...LINK_STATUSES] as const).map((key) => ({
              key,
              label: key === "all" ? t(`${P}.allStatuses`) : t(`${P}.status.${key}`),
            }))}
          />
        </div>
        <LinkFilters
          discounted={search.discounted}
          createdBy={search.created_by}
          onChange={(next) => {
            setSearch({ ...next, page: 1 })
          }}
        />
      </div>
      {list.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={list.data?.payment_links}
            rowKey={(row) => row.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            onRowClick={(row) => {
              void navigate({ to: "/payment-links/$id", params: { id: row.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <Link2 className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="max-w-md text-sm text-muted-foreground">
                  {t(filtered ? `${P}.emptyFiltered` : `${P}.empty`)}
                </p>
                {filtered ? null : (
                  <Button asChild>
                    <Link to="/payment-links/new">
                      <Plus />
                      {t(`${P}.new`)}
                    </Link>
                  </Button>
                )}
              </div>
            }
          />
          {list.data && list.data.count > LINK_PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={LINK_PAGE_SIZE}
              count={list.data.count}
              onPageChange={(next) => {
                setSearch({ page: next + 1 })
              }}
            />
          ) : null}
        </>
      )}
    </section>
  )
}

/**
 * Siparişler > Ödeme bağlantıları (adr/0051 §13): orders staff made for a
 * customer on the phone, in the DMs or at the counter, paid through a link.
 */
export function PaymentLinksPage() {
  const { t } = useTranslation()
  const gate = useLinkAccess()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/orders", label: t("nav.orders") }}
        title={t(`${P}.title`)}
        description={t(`${P}.description`)}
        action={
          gate.access === "ok" ? (
            <Button asChild>
              <Link to="/payment-links/new">
                <Plus />
                {t(`${P}.new`)}
              </Link>
            </Button>
          ) : null
        }
      />
      <LinkGate gate={gate}>
        <LinkList />
      </LinkGate>
    </div>
  )
}
