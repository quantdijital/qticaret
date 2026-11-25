import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { SEARCH_FORM_TABS_MAX, sectionIconOf } from "@qticaret/types"
import type { SearchFormTab } from "@qticaret/types"
import { EmptyLine } from "@/features/settings/components/storefront-rows"
import { categoriesQuery } from "@/features/products/api/lookups"
import { IconSelect } from "./shared/icon-select"

const S = "storefront.editor.theme.searchForm.tabs"

/**
 * The search box's tabs (`search_form.tabs`): the shop's top categories,
 * each ticked to stand as a tab, in the shop's order, with the small icon
 * picked beside it. None ticked: every top category, no icon (today's). A
 * tab whose category went keeps its place until the shop unticks it.
 */
export function SearchTabsField({
  id,
  label,
  tabs,
  onChange,
}: {
  id: string
  label: string
  tabs: readonly SearchFormTab[]
  onChange: (tabs: SearchFormTab[]) => void
}) {
  const { t } = useTranslation()
  const categories = useQuery(categoriesQuery())
  const top = (categories.data ?? [])
    .filter((category) => !category.parent_category_id)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  const ticked = new Map(tabs.map((tab) => [tab.handle, tab]))
  const known = new Set(top.map((category) => category.handle))
  const rows = [
    ...top.map((category) => ({ handle: category.handle, name: category.name })),
    ...tabs
      .filter((tab) => !known.has(tab.handle))
      .map((tab) => ({ handle: tab.handle, name: tab.handle })),
  ]
  // Ticked ones in the rows' order: the shop's own category order
  const save = (next: ReadonlyMap<string, SearchFormTab>) => {
    onChange(rows.flatMap((row) => next.get(row.handle) ?? []).slice(0, SEARCH_FORM_TABS_MAX))
  }
  const full = ticked.size >= SEARCH_FORM_TABS_MAX
  return (
    <Field label={label} hint={t(`${S}.hint`)}>
      {rows.length === 0 ? (
        <EmptyLine text={t(`${S}.empty`)} />
      ) : (
        <ul id={id} aria-label={label} className="flex flex-col gap-2">
          {rows.map((row) => {
            const tab = ticked.get(row.handle)
            return (
              <li key={row.handle} className="flex items-center gap-2">
                <label className="flex w-40 min-w-0 shrink-0 items-center gap-2 text-sm">
                  <Checkbox
                    checked={tab !== undefined}
                    disabled={tab === undefined && full}
                    aria-label={t(`${S}.tabOf`, { name: row.name })}
                    onCheckedChange={(on) => {
                      const next = new Map(ticked)
                      if (on === true) {
                        next.set(row.handle, { handle: row.handle, icon: null })
                      } else {
                        next.delete(row.handle)
                      }
                      save(next)
                    }}
                  />
                  <span className="truncate">{row.name}</span>
                </label>
                {tab && (
                  <IconSelect
                    id={`${id}-icon-${row.handle}`}
                    label={t(`${S}.iconOf`, { name: row.name })}
                    value={sectionIconOf(tab.icon)}
                    noneLabel={t(`${S}.noIcon`)}
                    onChange={(icon) => {
                      save(new Map(ticked).set(row.handle, { handle: row.handle, icon }))
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Field>
  )
}
