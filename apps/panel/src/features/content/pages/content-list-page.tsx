import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Plus, Scale } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { SearchInput } from "@/components/patterns/search-input"
import { Button } from "@/components/ui/button"
import { CONTENT_TABS } from "@/features/content/api/content"
import type { ContentKind, ContentTab } from "@/features/content/api/content"
import type { TermKind } from "@/features/content/api/terms"
import { EntryList } from "@/features/content/components/entry-list"
import { LandingList } from "@/features/content/components/landing-list"
import { NewContentDialog } from "@/features/content/components/new-content-dialog"
import { NewLandingDialog } from "@/features/content/components/new-landing-dialog"
import { NewTermForm } from "@/features/content/components/new-term-form"
import { TermList } from "@/features/content/components/term-list"
import { cn } from "@/lib/utils"

const route = getRouteApi("/_auth/content/")

const entryKindOf = (tab: ContentTab): ContentKind | null =>
  tab === "page" || tab === "post" ? tab : null
const termKindOf = (tab: ContentTab): TermKind | null =>
  tab === "category" || tab === "tag" ? tab : null

/**
 * Content pages and blog posts (F3.16, docs/06): the shop's own pages, its
 * blog with its categories and tags (adr/0019 ek 2026-11-03), and the
 * filter pages.
 */
export function ContentListPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const tab: ContentTab = search.kind ?? "page"
  const entryKind = entryKindOf(tab)
  const termKind = termKindOf(tab)
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const [adding, setAdding] = useState(false)
  const setSearch = (next: { kind?: ContentTab; q?: string; page?: number }) => {
    const merged = { kind: tab, q, page: page + 1, ...next }
    void navigate({
      to: "/content",
      search: {
        kind: merged.kind === "page" ? undefined : merged.kind,
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
            placeholder={t(termKind ? "content.terms.search" : "content.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          {tab === "page" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Scale className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {t("content.legal.hint")}{" "}
                <Link
                  to="/settings/legal"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {t("content.legal.link")}
                </Link>
              </span>
            </p>
          ) : null}
          {termKind ? <NewTermForm key={termKind} kind={termKind} /> : null}
        </div>
        {termKind ? (
          <TermList kind={termKind} q={q} page={page} onPage={onPage} />
        ) : entryKind ? (
          <EntryList kind={entryKind} q={q} page={page} onPage={onPage} add={add} />
        ) : (
          <LandingList q={q} page={page} onPage={onPage} add={add} />
        )}
      </section>
      {tab === "landing" ? (
        <NewLandingDialog open={adding} onOpenChange={setAdding} />
      ) : entryKind ? (
        <NewContentDialog kind={entryKind} open={adding} onOpenChange={setAdding} />
      ) : null}
    </div>
  )
}
