import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Plus, Store } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useWholesaleOpen } from "@/features/wholesale/api/access"
import {
  ACCOUNTS_PAGE_SIZE,
  accountCountsQuery,
  accountsQuery,
} from "@/features/wholesale/api/accounts"
import type { AccountStatus, WholesaleAccount } from "@/features/wholesale/api/types"
import { useAccountColumns } from "@/features/wholesale/components/account-columns"
import { DeleteAccountDialog } from "@/features/wholesale/components/delete-account"
import { NewWholesalerDialog } from "@/features/wholesale/components/new-wholesaler-dialog"
import { WholesaleGate } from "@/features/wholesale/components/wholesale-gate"
import { WholesaleNav } from "@/features/wholesale/components/wholesale-nav"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/wholesale/")
const W = "wholesale.list"

type StatusTab = AccountStatus | "all"

function WholesalersList({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const status: StatusTab = search.status ?? "all"
  const page = (search.page ?? 1) - 1
  const q = search.q ?? ""
  const list = useQuery(accountsQuery({ q, status, page }))
  const counts = useQuery(accountCountsQuery())
  // The account stays mounted after the dialog closes, so the delete's answer still reports
  const [deleting, setDeleting] = useState<WholesaleAccount | null>(null)
  const [asking, setAsking] = useState(false)
  const columns = useAccountColumns((account) => {
    setDeleting(account)
    setAsking(true)
  })
  const setSearch = (next: { q?: string; status?: StatusTab; page?: number }) => {
    const nextStatus = next.status ?? status
    void navigate({
      to: "/wholesale",
      search: {
        q: (next.q ?? q) || undefined,
        status: nextStatus === "all" ? undefined : nextStatus,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const filtered = q !== "" || status !== "all"
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card">
      <FilterTabs
        label={t(`${W}.views`)}
        value={status}
        onChange={(next) => {
          setSearch({ status: next, page: 1 })
        }}
        tabs={[
          { key: "all", label: t(`${W}.tabs.all`), count: counts.data?.all },
          { key: "active", label: t("wholesale.status.active"), count: counts.data?.active },
          { key: "inactive", label: t("wholesale.status.inactive"), count: counts.data?.inactive },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <SearchInput
          value={q}
          placeholder={t(`${W}.search`)}
          onChange={(text) => {
            setSearch({ q: text, page: 1 })
          }}
        />
      </div>
      {list.isError ? (
        <div className="px-5 pb-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={list.data?.accounts}
            rowKey={(account) => account.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            onRowClick={(account) => {
              void navigate({ to: "/wholesale/$id", params: { id: account.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <Store className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {filtered ? t(`${W}.noMatch`) : t(`${W}.empty`)}
                </p>
                {filtered ? null : (
                  <Button variant="outline" onClick={onAdd}>
                    <Plus />
                    {t(`${W}.add`)}
                  </Button>
                )}
              </div>
            }
          />
          {deleting ? (
            <DeleteAccountDialog
              key={deleting.id}
              account={deleting}
              open={asking}
              onOpenChange={setAsking}
            />
          ) : null}
          {list.data && list.data.count > 0 ? (
            <Pagination
              page={page}
              pageSize={ACCOUNTS_PAGE_SIZE}
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
 * Toptancılar (ADR-0068 slice 2; its own menu item, the owner 2026-11-16): every
 * wholesaler, active or closed, found by address, company or contact. Owner and admin
 * only, while the shop sells wholesale.
 */
export function WholesalersPage() {
  const { t } = useTranslation()
  const ready = useWholesaleOpen()
  const [adding, setAdding] = useState(false)
  const open = () => {
    setAdding(true)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${W}.title`)}
        description={t(`${W}.description`)}
        action={
          ready ? (
            <Button onClick={open}>
              <Plus />
              {t(`${W}.add`)}
            </Button>
          ) : undefined
        }
      />
      <WholesaleNav />
      <WholesaleGate>
        <WholesalersList onAdd={open} />
        <NewWholesalerDialog open={adding} onOpenChange={setAdding} />
      </WholesaleGate>
    </div>
  )
}
