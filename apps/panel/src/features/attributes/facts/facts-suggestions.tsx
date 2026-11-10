import { useTranslation } from "react-i18next"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { ATTRIBUTE_TYPES } from "@/features/attributes/types"
import type { AttributeTemplate } from "@/features/attributes/types"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { choiceOf } from "./choices"
import type { Choices, LabelChoice } from "./choices"
import type { FieldSuggestion } from "./types"

const F = "attributes.facts"
const NONE = "__none__"
const TRIGGER = "h-8 w-full sm:w-44"

interface RowProps {
  template: AttributeTemplate
  suggestion: FieldSuggestion
  choice: LabelChoice
  onChange: (next: LabelChoice) => void
}

function SuggestionRow({ template, suggestion, choice, onChange }: RowProps) {
  const { t } = useTranslation()
  const id = `facts-${template.id}-${suggestion.name}`
  const groups = [...(template.groups ?? [])].sort((a, b) => a.rank - b.rank)
  const fields = template.definitions.filter((each) => each.scope === "product")
  return (
    <li className="flex min-h-12 flex-col gap-2 border-t py-2.5 first:border-t-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{suggestion.label}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {t(`${F}.suggestionLine`, {
            count: suggestion.products,
            formatted: formatCount(suggestion.products),
            values: suggestion.values.slice(0, 3).join(", "),
          })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="flex h-8 cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            id={id}
            checked={choice.add}
            onCheckedChange={(checked) => {
              onChange({ ...choice, add: checked === true, aliasOf: "" })
            }}
          />
          {t(`${F}.addField`)}
        </label>
        {choice.add ? (
          <>
            <Select
              value={choice.type}
              onValueChange={(type) => {
                onChange({ ...choice, type: type as LabelChoice["type"] })
              }}
            >
              <SelectTrigger className={TRIGGER} aria-label={t(`${F}.fieldType`)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTRIBUTE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`attributes.types.${type}`)}
                    {type === "number" && suggestion.unit ? ` (${suggestion.unit})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {groups.length > 0 ? (
              <Select
                value={choice.group || NONE}
                onValueChange={(group) => {
                  onChange({ ...choice, group: group === NONE ? "" : group })
                }}
              >
                <SelectTrigger className={TRIGGER} aria-label={t(`${F}.fieldGroup`)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t(`${F}.noGroup`)}</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.key} value={group.key}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        ) : fields.length > 0 ? (
          <Select
            value={choice.aliasOf || NONE}
            onValueChange={(key) => {
              onChange({ ...choice, aliasOf: key === NONE ? "" : key })
            }}
          >
            <SelectTrigger
              className={TRIGGER}
              aria-label={t(`${F}.aliasOf`, { label: suggestion.label })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t(`${F}.noAlias`)}</SelectItem>
              {fields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {t(`${F}.aliasTo`, { field: field.label })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </li>
  )
}

/**
 * The labels none of a template's fields names (adr/0013 Ek 2026-11-05),
 * each with how many products give it and a few of its values: left as
 * it is, added as a field (its kind read from the values, in the section
 * its rows sit under), or kept as another name of a field the template has.
 */
export function FactsSuggestions({
  suggestions,
  templates,
  choices,
  onChange,
}: {
  suggestions: readonly { template_id: string; fields: FieldSuggestion[] }[]
  templates: ReadonlyMap<string, AttributeTemplate>
  choices: Choices
  onChange: (templateId: string, suggestion: FieldSuggestion, next: LabelChoice) => void
}) {
  const { t } = useTranslation()
  const several = suggestions.length > 1
  return (
    <div className="flex flex-col gap-3">
      {suggestions.map(({ template_id, fields }) => {
        const template = templates.get(template_id)
        if (!template) {
          return null
        }
        return (
          <div key={template_id} className="flex flex-col gap-1">
            {several ? (
              <p className="text-[13px] font-medium text-muted-foreground">
                {t(`${F}.templateName`, { name: template.name })}
              </p>
            ) : null}
            <ul className="rounded-md border px-3">
              {fields.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.name}
                  template={template}
                  suggestion={suggestion}
                  choice={choiceOf(choices, template_id, suggestion)}
                  onChange={(next) => {
                    onChange(template_id, suggestion, next)
                  }}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
