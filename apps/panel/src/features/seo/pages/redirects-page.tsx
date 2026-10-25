import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Download, FileUp, MoreHorizontal, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { SearchInput } from "@/components/patterns/search-input"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  REDIRECT_EXPORT_URL,
  REDIRECT_MATCHES,
  redirectCountsQuery,
} from "@/features/seo/api/redirects"
import type { RedirectMatch } from "@/features/seo/api/redirects"
import type { RedirectForm } from "@/features/seo/redirects/form"
import { ImportDialog } from "@/features/seo/redirects/import-dialog"
import { NotFoundTab } from "@/features/seo/redirects/not-found-tab"
import { OldPathsTab } from "@/features/seo/redirects/old-paths-tab"
import { PathTester } from "@/features/seo/redirects/path-tester"
import { RedirectDialog } from "@/features/seo/redirects/redirect-dialog"
import { RulesTab } from "@/features/seo/redirects/rules-tab"
import { REDIRECT_TABS } from "@/features/seo/search"
import type { RedirectsSearch } from "@/features/seo/search"

const route = getRouteApi("/_auth/seo/redirects")
const ALL = "all"

/**
 * Redirects (docs/13 §4, adr/0017): the shop's own rules, the addresses
 * products and categories left behind, and the 404s visitors hit, with a
 * one-click way to send them somewhere. A tester shows what any address
 * answers now.
 */
export function RedirectsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const tab = search.tab ?? "rules"
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const counts = useQuery(redirectCountsQuery())
  const [adding, setAdding] = useState<Partial<RedirectForm> | null>(null)
  const [importing, setImporting] = useState(false)

  const setSearch = (next: Partial<RedirectsSearch>) => {
    void navigate({
      to: "/seo/redirects",
      search: (previous: RedirectsSearch) => {
        const merged = { ...previous, ...next }
        return {
          tab: merged.tab === "rules" ? undefined : merged.tab,
          // An emptied search box leaves the URL
          q: merged.q === "" ? undefined : merged.q,
          match: merged.tab === "rules" || merged.tab === undefined ? merged.match : undefined,
          page: merged.page && merged.page > 1 ? merged.page : undefined,
        }
      },
      replace: true,
    })
  }
  const onPage = (next: number) => {
    setSearch({ page: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/seo", label: t("nav.seo") }}
        title={t("seo.redirects.title")}
        description={t("seo.redirects.description")}
        action={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("seo.redirects.fileMenu")}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setImporting(true)
                  }}
                >
                  <FileUp />
                  {t("seo.redirects.import.title")}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={REDIRECT_EXPORT_URL} download>
                    <Download />
                    {t("seo.redirects.export")}
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                setAdding({})
              }}
            >
              <Plus />
              {t("seo.redirects.add")}
            </Button>
          </>
        }
      />
      <SectionCard
        title={t("seo.redirects.tester.title")}
        description={t("seo.redirects.tester.hint")}
      >
        <PathTester />
      </SectionCard>
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("seo.redirects.title")}
          value={tab}
          onChange={(next) => {
            setSearch({ tab: next, q: "", page: 1 })
          }}
          tabs={REDIRECT_TABS.map((key) => ({
            key,
            label: t(`seo.redirects.tabs.${key}`),
            count: counts.data?.[key],
          }))}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("seo.redirects.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          {tab === "rules" ? (
            <Select
              value={search.match ?? ALL}
              onValueChange={(next) => {
                setSearch({ match: next === ALL ? undefined : (next as RedirectMatch), page: 1 })
              }}
            >
              <SelectTrigger className="w-40" aria-label={t("seo.redirects.matchFilter")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("seo.redirects.allRules")}</SelectItem>
                {REDIRECT_MATCHES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`seo.redirects.matches.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {tab === "rules" ? (
          <RulesTab
            q={q}
            page={page}
            match={search.match}
            onPage={onPage}
            onAdd={() => {
              setAdding({})
            }}
          />
        ) : tab === "old" ? (
          <OldPathsTab q={q} page={page} onPage={onPage} />
        ) : (
          <NotFoundTab
            q={q}
            page={page}
            onPage={onPage}
            onOpenForm={(entry) => {
              setAdding({ source: entry.path, target: entry.suggestions[0]?.path ?? "" })
            }}
          />
        )}
      </section>
      <RedirectDialog
        open={adding !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(null)
          }
        }}
        initial={adding ?? undefined}
      />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </div>
  )
}
