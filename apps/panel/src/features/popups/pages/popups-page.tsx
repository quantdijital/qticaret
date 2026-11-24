import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { AppWindow, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { POPUPS_PAGE_SIZE, popupsQuery } from "@/features/popups/api/popups"
import { POPUPS_FLAG, POPUP_TYPES } from "@/features/popups/api/types"
import { useFeatureState } from "@/features/settings/api/features"
import type { PopupType } from "@/features/popups/api/types"
import { usePopupColumns } from "@/features/popups/components/popup-columns"
import { useCanWritePopups } from "@/features/popups/api/access"
import { PopupsGate } from "@/features/popups/components/popups-gate"
import type { PopupsSearch } from "@/features/popups/search"
import { errorText } from "@/lib/errors"

const P = "popups"
const route = getRouteApi("/_auth/popups/")

type TypeView = PopupType | "all"

function NewButton() {
  const { t } = useTranslation()
  return (
    <Button asChild>
      <Link to="/popups/new">
        <Plus />
        {t(`${P}.new`)}
      </Link>
    </Button>
  )
}

/** The pop-ups, newest first: the name and the type filtered by the server. */
function PopupList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const canWrite = useCanWritePopups()
  const search = route.useSearch()
  const q = search.q ?? ""
  const type: TypeView = search.type ?? "all"
  const page = (search.page ?? 1) - 1
  const list = useQuery(
    popupsQuery({ q: q.trim() || null, type: type === "all" ? null : type, page })
  )
  const columns = usePopupColumns(canWrite)
  const setSearch = (next: { q?: string; type?: TypeView; page?: number }) => {
    const nextType = next.type ?? type
    const nextQ = (next.q ?? q).trim()
    const query: PopupsSearch = {
      q: nextQ === "" ? undefined : nextQ,
      type: nextType === "all" ? undefined : nextType,
      page: next.page && next.page > 1 ? next.page : undefined,
    }
    void navigate({ to: "/popups", search: query, replace: true })
  }
  const filtered = type !== "all" || q.trim() !== ""
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b pr-3 pb-2 sm:pb-0">
        <div className="min-w-0 flex-1 [&>[role=tablist]]:border-b-0">
          <FilterTabs
            label={t(`${P}.views`)}
            value={type}
            onChange={(next) => {
              setSearch({ type: next, page: 1 })
            }}
            tabs={(["all", ...POPUP_TYPES] as const).map((key) => ({
              key,
              label: key === "all" ? t(`${P}.allTypes`) : t(`${P}.types.${key}`),
            }))}
          />
        </div>
        <SearchInput
          className="ml-3 w-full sm:ml-0 sm:w-56"
          value={q}
          placeholder={t(`${P}.search`)}
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
        <>
          <DataTable
            columns={columns}
            rows={list.data?.popups}
            rowKey={(row) => row.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            onRowClick={(row) => {
              void navigate({ to: "/popups/$id", params: { id: row.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <AppWindow className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {t(filtered ? `${P}.emptyFiltered` : `${P}.empty`)}
                </p>
                {filtered || !canWrite ? null : <NewButton />}
              </div>
            }
          />
          {list.data && list.data.count > POPUPS_PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={POPUPS_PAGE_SIZE}
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

/** Pazarlama > Pop-up'lar (adr/0080 S2): info, campaign and newsletter pop-ups on the storefront. */
export function PopupsPage() {
  const { t } = useTranslation()
  const canWrite = useCanWritePopups()
  const on = useFeatureState(POPUPS_FLAG)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${P}.title`)}
        description={t(`${P}.description`)}
        action={canWrite && on ? <NewButton /> : null}
      />
      <PopupsGate>
        <PopupList />
      </PopupsGate>
    </div>
  )
}
