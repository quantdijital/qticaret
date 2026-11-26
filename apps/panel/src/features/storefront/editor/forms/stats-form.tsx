import { useTranslation } from "react-i18next"
import { ListFooter, RowActions } from "@/features/settings/components/storefront-rows"
import { HAND_NOTE_MAX, STATS_LIMITS, statsSettingsOf } from "@qticaret/types"
import type { StatsItem, StatsSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { IconSelect } from "../shared/icon-select"
import { F, TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"

const S = "storefront.editor.stats"

/**
 * The figures strip's content (adr/0077 §10): an optional title and two to
 * six figures in order, each a short value, its label and an optional
 * line. Its hairlines stand in "Diziliş" (`PointsGroups`), its ground and
 * alignment in "Görünüm" (the look).
 */
export function StatsForm({ section, problems, onChange }: SectionFormProps<StatsSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const { min, max } = STATS_LIMITS.items
  // Each figure's icon while the strip shows icons ("Diziliş", adr/0077 §10 Ek)
  const showIcons = statsSettingsOf(section).icons === "on"
  const setItems = (items: StatsItem[], field?: string) => {
    onChange({ ...section, items }, field)
  }
  const setItem = (index: number, next: Partial<StatsItem>, field: keyof StatsItem) => {
    setItems(
      section.items.map((item, at) => (at === index ? { ...item, ...next } : item)),
      `items.${String(index)}.${field}`
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        term={t(`${F}.titleTerm`)}
        value={section.title}
        max={L.title}
        hint={t(`${S}.titleHint`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <TextField
        id={PREVIEW_IDS.text(section.id, "eyebrow")}
        label={t(`${S}.eyebrow`)}
        hint={t(`${S}.eyebrowHint`)}
        value={section.eyebrow ?? null}
        max={STATS_LIMITS.eyebrow}
        error={problem(problems["eyebrow"], STATS_LIMITS.eyebrow)}
        onChange={(eyebrow) => {
          onChange({ ...section, eyebrow }, "eyebrow")
        }}
      />
      <TextField
        id={PREVIEW_IDS.text(section.id, "note")}
        label={t(`${S}.note`)}
        hint={t(`${S}.noteHint`)}
        value={section.note ?? null}
        max={HAND_NOTE_MAX}
        error={problem(problems["note"], HAND_NOTE_MAX)}
        onChange={(note) => {
          onChange({ ...section, note }, "note")
        }}
      />
      <ol aria-label={t(`${S}.items`)} className="flex flex-col gap-3">
        {section.items.map((item, index) => {
          const number = index + 1
          const at = `items.${String(index)}`
          const name = t(`${S}.item`, { number })
          return (
            <li key={index} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{name}</span>
                <RowActions
                  index={index}
                  count={section.items.length}
                  item={name}
                  removable={section.items.length > min}
                  onMove={(to) => {
                    const next = section.items.filter((_, place) => place !== index)
                    next.splice(to, 0, item)
                    setItems(next)
                  }}
                  onRemove={() => {
                    setItems(section.items.filter((_, place) => place !== index))
                  }}
                />
              </div>
              {showIcons && (
                <IconSelect
                  id={`${section.id}-${at}-icon`}
                  label={t(`${S}.iconOf`, { number })}
                  value={item.icon}
                  onChange={(icon) => {
                    // No icon: the figure without the field, as one from before icons
                    const rest: StatsItem = {
                      value: item.value,
                      label: item.label,
                      text: item.text,
                    }
                    setItems(
                      section.items.map((each, place) =>
                        place === index ? (icon ? { ...rest, icon } : rest) : each
                      ),
                      `${at}.icon`
                    )
                  }}
                />
              )}
              <TextField
                id={PREVIEW_IDS.text(section.id, `${at}.value`)}
                label={t(`${S}.value`, { number })}
                value={item.value}
                max={STATS_LIMITS.value}
                placeholder={t(`${S}.valuePlaceholder`)}
                hint={t(`${S}.valueHint`)}
                required
                error={problem(problems[`${at}.value`], STATS_LIMITS.value)}
                onChange={(value) => {
                  setItem(index, { value: value ?? "" }, "value")
                }}
              />
              <TextField
                id={PREVIEW_IDS.text(section.id, `${at}.label`)}
                label={t(`${S}.label`, { number })}
                value={item.label}
                max={STATS_LIMITS.label}
                placeholder={t(`${S}.labelPlaceholder`)}
                tokens
                required
                error={problem(problems[`${at}.label`], STATS_LIMITS.label)}
                onChange={(label) => {
                  setItem(index, { label: label ?? "" }, "label")
                }}
              />
              <TextField
                id={PREVIEW_IDS.text(section.id, `${at}.text`)}
                label={t(`${S}.text`, { number })}
                value={item.text}
                max={STATS_LIMITS.text}
                tokens
                error={problem(problems[`${at}.text`], STATS_LIMITS.text)}
                onChange={(text) => {
                  setItem(index, { text }, "text")
                }}
              />
            </li>
          )
        })}
      </ol>
      <ListFooter
        label={t(`${S}.add`)}
        hint={t(`${S}.hint`, { min, max })}
        full={section.items.length >= max}
        onAdd={() => {
          setItems([...section.items, { value: "", label: "", text: null }])
        }}
      />
    </div>
  )
}
