import { FileText, ListChecks } from "lucide-react"
import { useTranslation } from "react-i18next"
import { documentsOf } from "@/features/settings/api/migration"
import type { KindCounts, MigrationMode } from "@/features/settings/api/migration"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const D = "settings.migration.run.descriptions"

type Counts = Partial<Record<string, KindCounts>>

/**
 * How many products' descriptions keep their headings, lists and tables
 * (ADR-0055); the rest had none, or only plain text in the source.
 */
export function DocumentsLine({ mode, documents }: { mode: MigrationMode; documents: number }) {
  const { t } = useTranslation()
  return (
    <p className="flex items-start gap-2 rounded-md border bg-card px-3 py-2.5 text-[13px]">
      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">
          {t(mode === "apply" ? `${D}.documents` : `${D}.plannedDocuments`, {
            count: documents,
            formatted: formatCount(documents),
          })}
        </span>
        <span className="text-muted-foreground">{t(`${D}.documentsHint`)}</span>
      </span>
    </p>
  )
}

/**
 * The facts the new products' descriptions stated (adr/0013 Ek
 * 2026-11-05): how many went to their template's fields, and how many
 * rows wait for the shop on the products list's "Açıklamadaki
 * özellikleri aktar".
 */
export function FactsLine({
  mode,
  facts,
}: {
  mode: MigrationMode
  facts: { written: number; left: number }
}) {
  const { t } = useTranslation()
  return (
    <p className="flex items-start gap-2 rounded-md border bg-card px-3 py-2.5 text-[13px]">
      <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">
          {t(mode === "apply" ? `${D}.facts` : `${D}.plannedFacts`, {
            count: facts.written,
            formatted: formatCount(facts.written),
          })}
        </span>
        {facts.left > 0 ? (
          <span className="text-muted-foreground">
            {t(`${D}.factsLeft`, { count: facts.left, formatted: formatCount(facts.left) })}
          </span>
        ) : null}
      </span>
    </p>
  )
}

/**
 * A description refresh's outcome (ADR-0055): the descriptions rewritten,
 * those already the same, products no earlier run moved (a full run moves
 * them first) and refusals.
 */
export function RefreshResult({ mode, counts }: { mode: MigrationMode; counts: Counts }) {
  const { t } = useTranslation()
  const product = counts["product"]
  const rows = [
    {
      key: "refreshed",
      label: t(mode === "apply" ? `${D}.refreshed` : `${D}.plannedRefreshed`),
      value: product?.updated ?? 0,
    },
    { key: "same", label: t(`${D}.same`), value: product?.found ?? 0 },
    {
      key: "notMoved",
      label: t(`${D}.notMoved`),
      hint: t(`${D}.notMovedHint`),
      value: product?.skipped ?? 0,
    },
    { key: "failed", label: t(`${D}.failed`), value: product?.failed ?? 0 },
  ]
  const documents = documentsOf(counts)
  return (
    <ul className="flex flex-col divide-y rounded-md border bg-card">
      {rows
        .filter((row) => row.key === "refreshed" || row.value > 0)
        .map((row) => (
          <li key={row.key} className="flex flex-col gap-0.5 px-3 py-2.5">
            <p className="flex items-center justify-between gap-3 text-sm">
              <span className={row.key === "refreshed" ? "font-medium" : ""}>{row.label}</span>
              <span className="tabular-nums">{formatCount(row.value)}</span>
            </p>
            {row.hint ? <p className="text-[13px] text-muted-foreground">{row.hint}</p> : null}
          </li>
        ))}
      {documents !== null ? (
        <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
          <span>{t(`${D}.withDocument`)}</span>
          <span className="tabular-nums">{formatCount(documents)}</span>
        </li>
      ) : null}
    </ul>
  )
}
