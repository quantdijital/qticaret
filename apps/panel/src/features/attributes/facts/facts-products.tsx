import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { AttributeTemplate } from "@/features/attributes/types"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { factValueText } from "./format"
import type { FactRow, FactStatus, FactsProductPreview } from "./types"

const F = "attributes.facts"
// Products listed in full; the run takes every one named
const SHOWN = 100

const TONE: Readonly<Record<FactStatus, StatusTone>> = {
  ready: "success",
  same: "neutral",
  filled: "warning",
  unparsed: "warning",
  conflict: "warning",
  ambiguous: "warning",
  unmatched: "neutral",
}

const count = (value: number) => ({ count: value, formatted: formatCount(value) })

function RowLine({
  row,
  template,
  overwrite,
}: {
  row: FactRow
  template: AttributeTemplate | undefined
  overwrite: boolean
}) {
  const { t } = useTranslation()
  const field = template?.definitions.find((each) => each.key === row.field)
  const named = (key: string) =>
    template?.definitions.find((each) => each.key === key)?.label ?? key
  const status =
    row.status === "filled" && overwrite
      ? t(`${F}.status.overwrite`)
      : t(`${F}.status.${row.status}`)
  let detail = ""
  if (row.status === "ready" || row.status === "same" || row.status === "filled") {
    detail = `${field?.label ?? row.field ?? ""}: ${factValueText(t, field, row.value_parsed)}`
  }
  if (row.status === "filled") {
    detail += ` · ${t(`${F}.current`, { value: factValueText(t, field, row.current) })}`
  } else if (row.status === "unparsed" && row.reason) {
    detail = `${field?.label ?? ""}: ${t(`${F}.reasons.${row.reason}`)}`
  } else if (row.status === "ambiguous") {
    detail = (row.fields ?? []).map(named).join(", ")
  }
  return (
    <li className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t px-3 py-2 text-sm first:border-t-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
      <span className="min-w-0">
        <span className="font-medium">{row.label}</span>
        {row.context ? <span className="text-muted-foreground"> · {row.context}</span> : null}
        <span className="block truncate text-muted-foreground">{row.value}</span>
      </span>
      <span className="col-span-2 row-start-2 min-w-0 text-[13px] text-muted-foreground sm:col-span-1 sm:row-start-auto">
        {detail}
      </span>
      <span className="col-start-2 row-start-1 sm:col-start-auto">
        <StatusBadge tone={row.status === "filled" && overwrite ? "success" : TONE[row.status]}>
          {status}
        </StatusBadge>
      </span>
    </li>
  )
}

/**
 * Each product's rows (adr/0013 Ek 2026-11-05): what its description
 * says, the field each goes to with its value as the field takes it, or
 * why it stays. One product opens at once; for many each opens on a click.
 */
export function FactsProducts({
  products,
  templates,
  overwrite,
}: {
  products: readonly FactsProductPreview[]
  templates: ReadonlyMap<string, AttributeTemplate>
  overwrite: boolean
}) {
  const { t } = useTranslation()
  const withRows = products.filter((product) => product.rows.length > 0)
  const without = products.length - withRows.length
  const single = products.length === 1
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {withRows.slice(0, SHOWN).map((product) => {
          const template = product.template_id ? templates.get(product.template_id) : undefined
          const ready = product.rows.filter(
            (row) => row.status === "ready" || (overwrite && row.status === "filled")
          ).length
          return (
            <li key={product.id}>
              <details open={single} className="group rounded-md border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{product.title}</span>
                  {template ? null : (
                    <StatusBadge tone="warning">{t(`${F}.noTemplateBadge`)}</StatusBadge>
                  )}
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                    {t(`${F}.productLine`, {
                      ready: formatCount(ready),
                      rows: formatCount(product.rows.length),
                    })}
                  </span>
                </summary>
                <ul className="border-t">
                  {product.rows.map((row) => (
                    <RowLine
                      key={`${row.source_path}/${row.label}`}
                      row={row}
                      template={template}
                      overwrite={overwrite}
                    />
                  ))}
                </ul>
              </details>
            </li>
          )
        })}
      </ul>
      {withRows.length > SHOWN ? (
        <p className="text-[13px] text-muted-foreground">
          {t(`${F}.moreProducts`, count(withRows.length - SHOWN))}
        </p>
      ) : null}
      {without > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {t(`${F}.withoutFacts`, count(without))}
        </p>
      ) : null}
    </div>
  )
}
