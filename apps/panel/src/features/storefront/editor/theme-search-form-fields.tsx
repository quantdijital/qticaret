import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { SEARCH_FORM_PLACEHOLDER_MAX, searchFormOf } from "@qticaret/types"
import type { SearchFormSettings } from "@qticaret/types"
import { templatesQuery } from "@/features/attributes/api"
import { SEARCH_FORM_CATEGORY_STYLES } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { PanelGroup } from "./panel-header"
import { useSectionFlags } from "./section-flags"
import { ChoiceSelect, SwitchRow } from "./theme-fields"
import { THEME_FIELD, THEME_GROUP_TITLES } from "./forms/theme-registry"
import type { ThemeRegistryField } from "./forms/theme-registry"
import { whereAttributes } from "./forms/theme-registry-search"
import { SearchTabsField } from "./theme-search-tabs-field"

const C = "storefront.editor.theme"
const S = `${C}.searchForm`

/** The "where" choice that names no attribute: the box asks for words instead. */
const NONE = "__none"

interface SearchFormGroupProps {
  theme: ThemeSettings
  /** Opens the group now (the settings search's pick); null: none. */
  reveal: number | null
  onChange: (theme: ThemeSettings) => void
}

/**
 * "Arama kutusu" (adr/0077 §1): the shop's one search box's fields,
 * shop-wide (a `search_box` section, the top of the search page): the
 * "where" attribute, the categories and how they are offered, and, while
 * the shop sells dated products, the dates and the party. A draft from
 * before the group reads at its defaults.
 */
export function SearchFormGroup({ theme, reveal, onChange }: SearchFormGroupProps) {
  const { t } = useTranslation()
  const flags = useSectionFlags().on
  const form = searchFormOf(theme.search_form)
  const templates = useQuery(templatesQuery())
  const attributes = whereAttributes(templates.data ?? [])
  const set = (patch: Partial<SearchFormSettings>) => {
    onChange({ ...theme, search_form: { ...form, ...patch } })
  }
  const shown = (field: ThemeRegistryField) => field.shown(theme, new Set(), flags)
  const keyField = THEME_FIELD["search_form.attribute_key"]
  const hintField = THEME_FIELD["search_form.placeholder"]
  // As typed (its spaces too); the saved one is trimmed
  const rawHint = theme.search_form.placeholder ?? ""
  const styleField = THEME_FIELD["search_form.category_style"]
  const tabsField = THEME_FIELD["search_form.tabs"]
  // A key saved before its attribute went keeps its place, by its own name
  const keys = [
    NONE,
    ...attributes.keys(),
    ...(form.attribute_key && !attributes.has(form.attribute_key) ? [form.attribute_key] : []),
  ]
  const toggle = (
    name:
      | "show_category"
      | "show_dates"
      | "show_people"
      | "flexible_month"
      | "date_words"
      | "boxed_fields"
      | "tab_all"
  ) => {
    const field = THEME_FIELD[`search_form.${name}`]
    return shown(field) ? (
      <SwitchRow
        id={field.target}
        label={t(field.label)}
        hint={t(`${S}.${name}.hint`)}
        checked={form[name]}
        onChange={(on) => {
          set({ [name]: on })
        }}
      />
    ) : null
  }
  return (
    <PanelGroup
      name="searchForm"
      title={t(THEME_GROUP_TITLES.searchForm)}
      hint={t(`${C}.searchFormHint`)}
      reveal={reveal}
    >
      <ChoiceSelect
        id={keyField.target}
        label={t(keyField.label)}
        value={form.attribute_key ?? NONE}
        options={keys}
        onChange={(key) => {
          set({ attribute_key: key === NONE ? null : key })
        }}
        render={(key) =>
          key === NONE ? t(`${S}.attribute_key.none`) : (attributes.get(key) ?? key)
        }
        hint={t(`${S}.attribute_key.hint`)}
      />
      {shown(hintField) && (
        <Field
          label={t(hintField.label)}
          htmlFor={hintField.target}
          hint={t(`${S}.placeholder.hint`)}
        >
          <Input
            id={hintField.target}
            value={rawHint}
            maxLength={SEARCH_FORM_PLACEHOLDER_MAX}
            autoComplete="off"
            onChange={(event) => {
              const text = event.target.value
              set({ placeholder: text.trim() === "" ? null : text })
            }}
          />
        </Field>
      )}
      {toggle("show_category")}
      {shown(styleField) && (
        <ChoiceSelect
          id={styleField.target}
          label={t(styleField.label)}
          value={form.category_style}
          options={SEARCH_FORM_CATEGORY_STYLES}
          onChange={(category_style) => {
            set({ category_style })
          }}
          render={(style) =>
            t(styleField.options[SEARCH_FORM_CATEGORY_STYLES.indexOf(style)] ?? style)
          }
          hint={t(`${S}.category_style.hint`)}
        />
      )}
      {shown(tabsField) && (
        <SearchTabsField
          id={tabsField.target}
          label={t(tabsField.label)}
          tabs={form.tabs}
          onChange={(tabs) => {
            set({ tabs })
          }}
        />
      )}
      {toggle("tab_all")}
      {toggle("show_dates")}
      {toggle("flexible_month")}
      {toggle("date_words")}
      {toggle("show_people")}
      {toggle("boxed_fields")}
    </PanelGroup>
  )
}
