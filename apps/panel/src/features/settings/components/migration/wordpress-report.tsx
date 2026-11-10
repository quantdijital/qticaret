import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@qticaret/admin-ui/ui/tabs"
import type { KindCounts } from "@/features/settings/api/migration"
import { NOT_MOVED_KINDS } from "@/features/settings/api/migration-wordpress"
import type { WordpressReport as Report } from "@/features/settings/api/migration-wordpress"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const W = "settings.migration.wordpress.report"

/** Descriptive attributes, by how many products use each: not moved until an attribute template exists. */
function Attributes({ attributes }: { attributes: Report["attributes"] }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">{t(`${W}.attributesNote`)}</p>
      {!attributes ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-[13px] text-muted-foreground">
          {t(`${W}.attributesInFile`)}
        </p>
      ) : attributes.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-[13px] text-muted-foreground">
          {t(`${W}.noAttributes`)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[13px] text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t(`${W}.columns.attribute`)}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t(`${W}.columns.products`)}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t(`${W}.columns.values`)}
                </th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((attribute) => (
                <tr key={attribute.key} className="border-t">
                  <td className="px-3 py-2">
                    <span className="block">{attribute.name}</span>
                    <span className="block font-mono text-[12px] text-muted-foreground">
                      {attribute.key}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCount(attribute.products)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCount(attribute.values)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** What stays behind: pages kept only for their old addresses, then what the report names alone. */
function NotMoved({
  addressOnly,
  notMoved,
}: {
  addressOnly: number
  notMoved: Report["not_moved"]
}) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      <li className="flex flex-col gap-1 px-3 py-2.5">
        <p className="flex items-center justify-between gap-3 text-sm font-medium">
          {t(`${W}.addressOnly`)}
          <span className="tabular-nums">{formatCount(addressOnly)}</span>
        </p>
        <p className="text-[13px] text-muted-foreground">{t(`${W}.addressOnlyHint`)}</p>
      </li>
      {NOT_MOVED_KINDS.map((kind) => {
        const count = notMoved?.[kind]
        return (
          <li
            key={kind}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium">{t(`${W}.kinds.${kind}`)}</p>
              <p className="text-[13px] text-muted-foreground">{t(`${W}.why.${kind}`)}</p>
            </div>
            <span className="flex items-center gap-3">
              {count === undefined ? null : (
                <span className="text-sm tabular-nums">{formatCount(count)}</span>
              )}
              <StatusBadge tone="neutral">{t(`${W}.notMoved`)}</StatusBadge>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

interface WordpressReportProps {
  counts: Partial<Record<string, KindCounts>>
  report: Report
  /** The run's counts, as every source shows them. */
  children: ReactNode
}

/**
 * A WordPress run's result (adr/0042 Ek 2026-11-03), in tabs so the card
 * stays short: the counts, the descriptive attributes not moved, and what
 * else stayed behind (pages kept for their old addresses, which the owner
 * decides in the old addresses card; coupons, menus, product tags and blog
 * comments, named in the report only).
 */
export function WordpressReport({ counts, report, children }: WordpressReportProps) {
  const { t } = useTranslation()
  return (
    <Tabs defaultValue="counts" className="gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="counts">{t(`${W}.tabs.counts`)}</TabsTrigger>
        <TabsTrigger value="attributes">{t(`${W}.tabs.attributes`)}</TabsTrigger>
        <TabsTrigger value="notMoved">{t(`${W}.tabs.notMoved`)}</TabsTrigger>
      </TabsList>
      <TabsContent value="counts" className="min-w-0">
        {children}
      </TabsContent>
      <TabsContent value="attributes" className="min-w-0">
        <Attributes attributes={report.attributes} />
      </TabsContent>
      <TabsContent value="notMoved" className="min-w-0">
        <NotMoved addressOnly={counts["page"]?.skipped ?? 0} notMoved={report.not_moved} />
      </TabsContent>
    </Tabs>
  )
}
