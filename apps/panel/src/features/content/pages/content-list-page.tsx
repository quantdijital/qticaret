import { Navigate, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { Button } from "@qticaret/admin-ui/ui/button"
import { CONTENT_TABS } from "@/features/content/api/content"
import type { ContentKind, ContentTab } from "@/features/content/api/content"
import type { TermKind } from "@/features/content/api/terms"
import { AuthorDialog } from "@/features/content/components/author-dialog"
import { AuthorList } from "@/features/content/components/author-list"
import { EntryList } from "@/features/content/components/entry-list"
import { LandingList } from "@/features/content/components/landing-list"
import { NewContentDialog } from "@/features/content/components/new-content-dialog"
import { NewLandingDialog } from "@/features/content/components/new-landing-dialog"
import { NewTermForm } from "@/features/content/components/new-term-form"
import { TermList } from "@/features/content/components/term-list"
import { cn } from "@qticaret/admin-ui/lib/utils"

const route = getRouteApi("/_auth/content/")

const entryKindOf = (tab: ContentTab): ContentKind | null => (tab === "post" ? tab : null)
const termKindOf = (tab: ContentTab): TermKind | null =>
  tab === "category" || tab === "tag" ? tab : null

/**
 * The blog and the filter pages (F3.16, docs/06): the posts with their
 * categories, tags (adr/0019 ek 2026-11-03) and authors, and the filter
 * pages. The shop's own pages are the theme editor's (adr/0073 Ek
 * 2026-11-19 (2) K5): the old pages tab's address opens them there.
 */
export function ContentListPage() {
  const search = route.useSearch()
  return search.kind === "page" ? (
    <Navigate to="/storefront/editor" search={{ sayfa: "icerik" }} replace />
  ) : (
    <ContentTabs tab={search.kind ?? "post"} />
  )
}

function ContentTabs({ tab }: { tab: ContentTab }) {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const entryKind = entryKindOf(tab)
  const termKind = termKindOf(tab)
  const authors = tab === "author"
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const [adding, setAdding] = useState(false)
  const setSearch = (next: { kind?: ContentTab; q?: string; page?: number }) => {
    const merged = { kind: tab, q, page: page + 1, ...next }
    void navigate({
      to: "/content",
      search: {
        kind: merged.kind === "post" ? undefined : merged.kind,
        q: merged.q === "" ? undefined : merged.q,
        page: merged.page > 1 ? merged.page : undefined,
      },
      replace: true,
    })
  }
  const onPage = (next: number) => {
    setSearch({ page: next + 1 })
  }
  // Categories and tags are added in place, above their list: no second primary button
  const add = termKind ? null : (
    <Button
      onClick={() => {
        setAdding(true)
      }}
    >
      <Plus />
      {t(`content.add.${tab}`)}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.content")} description={t("content.description")} action={add} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("content.kinds")}
          value={tab}
          onChange={(next) => {
            setSearch({ kind: next, q: "", page: 1 })
          }}
          tabs={CONTENT_TABS.map((key) => ({ key, label: t(`content.tabs.${key}`) }))}
        />
        <div
          className={cn(
            "flex flex-wrap gap-3 px-5 py-3",
            termKind ? "items-start" : "items-center"
          )}
        >
          <SearchInput
            value={q}
            placeholder={t(termKind || authors ? "content.terms.search" : "content.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          {termKind ? <NewTermForm key={termKind} kind={termKind} /> : null}
        </div>
        {termKind ? (
          <TermList kind={termKind} q={q} page={page} onPage={onPage} />
        ) : authors ? (
          <AuthorList q={q} page={page} onPage={onPage} add={add} />
        ) : entryKind ? (
          <EntryList kind={entryKind} q={q} page={page} onPage={onPage} add={add} />
        ) : (
          <LandingList q={q} page={page} onPage={onPage} add={add} />
        )}
      </section>
      {tab === "landing" ? (
        <NewLandingDialog open={adding} onOpenChange={setAdding} />
      ) : authors ? (
        adding ? (
          <AuthorDialog
            author={null}
            onClose={() => {
              setAdding(false)
            }}
          />
        ) : null
      ) : entryKind ? (
        <NewContentDialog kind={entryKind} open={adding} onOpenChange={setAdding} />
      ) : null}
    </div>
  )
}
