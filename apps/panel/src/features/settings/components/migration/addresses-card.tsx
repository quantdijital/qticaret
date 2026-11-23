import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { FileUp, Info, Loader2, Map as MapIcon, Play } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  URL_FILTERS,
  addressSummaryQuery,
  addressesQuery,
  useAddressJob,
} from "@/features/settings/api/migration-addresses"
import type { AddressSummary, UrlFilter } from "@/features/settings/api/migration-addresses"
import { AddressRow } from "@/features/settings/components/migration/address-row"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const A = "settings.migration.addresses"
const PAGE = 50
const COUNTS = ["total", "matched", "decided", "undecided", "unsupported"] as const

/** Where the cutover stands: ready or not, the inventory's counts, the top addresses still unanswered. */
function Readiness({ summary }: { summary: AddressSummary }) {
  const { t } = useTranslation()
  const noTraffic = summary.top.checked === 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={summary.ready ? "success" : "warning"}>
          {t(summary.ready ? `${A}.ready` : `${A}.notReady`)}
        </StatusBadge>
        <span className="text-[13px] text-muted-foreground">
          {noTraffic
            ? t(`${A}.noTraffic`)
            : summary.top.unanswered.length > 0
              ? t(`${A}.unanswered`, { count: summary.top.unanswered.length })
              : null}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {COUNTS.map((count) => (
          <div
            key={count}
            className={cn(
              "flex flex-col gap-0.5 rounded-md border px-3 py-2",
              count === "total" ? "col-span-2 sm:col-span-1" : ""
            )}
          >
            <dt className="text-[13px] text-muted-foreground">{t(`${A}.counts.${count}`)}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatCount(summary[count])}</dd>
          </div>
        ))}
      </dl>
      <CategoryStyleHint hint={summary.category_style ?? null} />
    </div>
  )
}

/**
 * A category URL style that keeps more of the old site's category
 * addresses as they were (adr/0017 Ek 2026-11-23): said, never set; the
 * owner moves the style in SEO settings.
 */
function CategoryStyleHint({ hint }: { hint: AddressSummary["category_style"] | null }) {
  const { t } = useTranslation()
  if (!hint?.suggested) {
    return null
  }
  return (
    <p className="flex items-start gap-2 rounded-md bg-info-soft px-3 py-2.5 text-[13px] text-info-text">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {t(`${A}.categoryStyle`, {
          style: t(`settings.seo.style.category.${hint.suggested}`),
          kept: formatCount(hint.kept[hint.suggested]),
          total: formatCount(hint.total),
          now: formatCount(hint.kept[hint.current]),
        })}{" "}
        <Link
          to="/settings/seo"
          search={{ part: "addresses" }}
          className="font-medium underline underline-offset-2"
        >
          {t(`${A}.categoryStyleLink`)}
        </Link>
      </span>
    </p>
  )
}

/** Where the inventory comes from beside the records: the old sitemap, Search Console's export. */
function Sources() {
  const { t } = useTranslation()
  const job = useAddressJob()
  const [sitemap, setSitemap] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const fail = (failure: unknown) => toast.error(errorText(t, failure))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Field label={t(`${A}.sitemap`)} htmlFor="migration-sitemap">
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            id="migration-sitemap"
            type="url"
            placeholder="https://eski-magaza.com/sitemap.xml"
            value={sitemap}
            onChange={(event) => {
              setSitemap(event.target.value)
            }}
          />
          <Button
            variant="outline"
            disabled={!sitemap.trim() || job.isPending}
            onClick={() => {
              job.mutate(
                { kind: "sitemap", url: sitemap.trim() },
                { onSuccess: () => toast.success(t(`${A}.sitemapStarted`)), onError: fail }
              )
            }}
          >
            <MapIcon />
            {t(`${A}.readSitemap`)}
          </Button>
        </div>
      </Field>
      <Field
        label={t(`${A}.searchConsole`)}
        htmlFor="migration-gsc"
        hint={t(`${A}.searchConsoleHint`)}
      >
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            id="migration-gsc"
            type="file"
            accept=".zip,.csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
            }}
          />
          <Button
            variant="outline"
            disabled={!file || job.isPending}
            onClick={() => {
              if (file) {
                job.mutate(
                  { kind: "search_console", file },
                  {
                    onSuccess: (answer) =>
                      toast.success(
                        t(`${A}.uploaded`, { count: "addresses" in answer ? answer.addresses : 0 })
                      ),
                    onError: fail,
                  }
                )
              }
            }}
          >
            <FileUp />
            {t(`${A}.upload`)}
          </Button>
        </div>
      </Field>
    </div>
  )
}

/**
 * The old site's addresses (F14.7, adr/0042 §8): whether cutover is
 * ready, where they come from, and each one with what it answers today,
 * what an apply does and the owner's decision.
 */
function ApplyDecisions() {
  const { t } = useTranslation()
  const job = useAddressJob()
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <Button
        disabled={job.isPending}
        onClick={() => {
          setConfirming(true)
        }}
      >
        {job.isPending ? <Loader2 className="animate-spin" /> : <Play />}
        {t(`${A}.apply`)}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${A}.applyConfirmTitle`)}
        description={t(`${A}.applyConfirmText`)}
        confirmLabel={t(`${A}.apply`)}
        onConfirm={() => {
          setConfirming(false)
          job.mutate(
            { kind: "apply" },
            {
              onSuccess: () => toast.success(t(`${A}.applyStarted`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      />
    </>
  )
}

export function AddressesCard() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<UrlFilter>("all")
  const [page, setPage] = useState(0)
  const summary = useQuery(addressSummaryQuery())
  const list = useQuery(addressesQuery(filter, page * PAGE))
  return (
    <SectionCard
      title={t(`${A}.title`)}
      description={t(`${A}.description`)}
      action={<ApplyDecisions />}
      flush
    >
      <div className="flex flex-col gap-5 px-5 pb-5">
        {summary.data ? (
          <Readiness summary={summary.data} />
        ) : (
          <Skeleton className="h-24 rounded-md" />
        )}
        <Sources />
      </div>
      <FilterTabs
        label={t(`${A}.title`)}
        tabs={URL_FILTERS.map((key) => ({ key, label: t(`${A}.filters.${key}`) }))}
        value={filter}
        onChange={(next) => {
          setFilter(next)
          setPage(0)
        }}
      />
      {!list.data ? (
        <div className="p-5">
          <Skeleton className="h-40 rounded-md" />
        </div>
      ) : list.data.urls.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-muted-foreground">{t(`${A}.empty`)}</p>
      ) : (
        <>
          {/* Relative: the header's screen-reader text stays inside the scroll box, not past the page */}
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[13px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t(`${A}.columns.address`)}</th>
                  <th className="px-3 py-2 text-right font-medium">{t(`${A}.columns.clicks`)}</th>
                  <th className="px-3 py-2 font-medium">{t(`${A}.columns.state`)}</th>
                  <th className="px-3 py-2 font-medium">{t(`${A}.columns.action`)}</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">{t(`${A}.decide.save`)}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.urls.map((row) => (
                  <AddressRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE} count={list.data.count} onPageChange={setPage} />
        </>
      )}
    </SectionCard>
  )
}
