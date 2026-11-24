import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import {
  MAX_SYNONYM_GROUPS,
  SYNONYM_PAGE_SIZE,
  synonymsQuery,
  useDeleteSynonym,
} from "@/features/seo/api/synonyms"
import type { SynonymGroup } from "@/features/seo/api/synonyms"
import type { SeoSearch, SiteSearchSearch } from "@/features/seo/search"
import { SynonymDialog } from "@/features/seo/site-search/synonym-dialog"
import { useSynonymText } from "@/features/seo/site-search/synonym-text"
import { SynonymsTable } from "@/features/seo/site-search/synonyms-table"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/settings/seo")
const S = "seo.siteSearch"

/**
 * Settings > SEO's site search tab (adr/0056): the shop's synonym groups,
 * any term of which finds the others in the storefront's search. The owner
 * and admins keep them (`searchSynonyms`, as the API decides); the other
 * roles read them.
 */
export function SiteSearchTab() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const canWrite = useCan("searchSynonyms")
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const list = useQuery(synonymsQuery({ q, page }))
  const remove = useDeleteSynonym()
  const { failureText } = useSynonymText()
  // The group stays while the dialog closes, so its title does not change on the way out
  const [dialog, setDialog] = useState<{ open: boolean; group: SynonymGroup | null }>({
    open: false,
    group: null,
  })
  const [deleting, setDeleting] = useState<SynonymGroup | null>(null)

  const setSearch = (next: Partial<SiteSearchSearch>) => {
    void navigate({
      to: "/settings/seo",
      search: (previous: SeoSearch) => {
        const merged = { ...previous, ...next }
        return {
          part: "site-search",
          q: merged.q === "" ? undefined : merged.q,
          page: merged.page && merged.page > 1 ? merged.page : undefined,
        }
      },
      replace: true,
    })
  }
  const add = () => {
    setDialog({ open: true, group: null })
  }
  const edit = (group: SynonymGroup) => {
    setDialog({ open: true, group })
  }

  return (
    <>
      <SectionCard
        title={t(`${S}.title`)}
        description={t(`${S}.description`)}
        className="overflow-hidden"
        flush
        action={
          canWrite ? (
            <Button size="sm" onClick={add}>
              <Plus />
              {t(`${S}.add`)}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t(`${S}.search`)}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          {list.data ? (
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {q
                ? t(`${S}.found`, { count: list.data.count, shown: formatCount(list.data.count) })
                : t(`${S}.total`, {
                    count: list.data.count,
                    shown: formatCount(list.data.count),
                    max: formatCount(MAX_SYNONYM_GROUPS),
                  })}
            </span>
          ) : null}
        </div>
        {canWrite ? null : (
          <p className="mx-5 mb-3 rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
            {t(`${S}.readOnly`)}
          </p>
        )}
        {list.isError ? (
          <div className="border-t p-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <SynonymsTable
            rows={list.data?.synonyms}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            {...(canWrite ? { actions: { onEdit: edit, onDelete: setDeleting } } : {})}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  {q ? t(`${S}.noMatch`) : t(`${S}.empty`)}
                </p>
                {q || !canWrite ? null : (
                  <Button size="sm" variant="outline" onClick={add}>
                    {t(`${S}.add`)}
                  </Button>
                )}
              </div>
            }
          />
        )}
        {list.data && list.data.count > SYNONYM_PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={SYNONYM_PAGE_SIZE}
            count={list.data.count}
            onPageChange={(next) => {
              setSearch({ page: next + 1 })
            }}
          />
        ) : null}
      </SectionCard>
      <SynonymDialog
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((current) => ({ ...current, open }))
        }}
        group={dialog.group}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        title={t(`${S}.deleteTitle`)}
        description={t(`${S}.deleteText`, { terms: deleting?.terms.join(", ") ?? "" })}
        confirmLabel={t(`${S}.deleteConfirm`)}
        destructive
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSuccess: () => toast.success(t(`${S}.deleted`)),
              onError: (error) => toast.error(failureText(error)),
            })
          }
          setDeleting(null)
        }}
      />
    </>
  )
}
