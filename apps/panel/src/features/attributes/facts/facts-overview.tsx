import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AttributeTemplate } from "@/features/attributes/types"
import { formatCount } from "@/lib/format"
import type { FactsCounts } from "./types"

const F = "attributes.facts"
const NONE = "__none__"

interface OverviewProps {
  counts: FactsCounts
  /** Products without a template of their own, as the first reading found them. */
  bare: number
  /** Values the run would write as the preview stands. */
  values: number
  templates: readonly AttributeTemplate[]
  templateId: string | null
  onTemplate: (id: string | null) => void
  overwrite: boolean
  onOverwrite: (overwrite: boolean) => void
}

/**
 * What the preview found in a sentence; the template for products
 * without one (a product without a template has nowhere to put its
 * facts); and whether values the products hold are written over.
 */
export function FactsOverview({
  counts,
  bare,
  values,
  templates,
  templateId,
  onTemplate,
  overwrite,
  onOverwrite,
}: OverviewProps) {
  const { t } = useTranslation()
  const rows =
    counts.ready +
    counts.same +
    counts.filled +
    counts.unparsed +
    counts.conflict +
    counts.ambiguous +
    counts.unmatched
  const left = counts.unparsed + counts.conflict + counts.ambiguous + counts.unmatched
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" aria-live="polite">
        {t(`${F}.found`, {
          count: counts.with_facts,
          formatted: formatCount(counts.with_facts),
          rows: formatCount(rows),
          values: formatCount(values),
        })}
        {left > 0 ? ` ${t(`${F}.foundLeft`, { left: formatCount(left) })}` : ""}
      </p>
      {bare > 0 ? (
        <Field
          label={t(`${F}.templateFor`, {
            count: bare,
            formatted: formatCount(bare),
          })}
          htmlFor="facts-template"
          hint={t(`${F}.templateForHint`)}
        >
          <Select
            value={templateId ?? NONE}
            onValueChange={(next) => {
              onTemplate(next === NONE ? null : next)
            }}
          >
            <SelectTrigger id="facts-template" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t(`${F}.noTemplateChoice`)}</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {counts.filled > 0 ? (
        <label htmlFor="facts-overwrite" className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            id="facts-overwrite"
            className="mt-0.5"
            checked={overwrite}
            onCheckedChange={(checked) => {
              onOverwrite(checked === true)
            }}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t(`${F}.overwrite`)}</span>
            <span className="text-[13px] text-muted-foreground">
              {t(`${F}.overwriteHint`, {
                count: counts.filled,
                formatted: formatCount(counts.filled),
              })}
            </span>
          </span>
        </label>
      ) : null}
    </div>
  )
}
