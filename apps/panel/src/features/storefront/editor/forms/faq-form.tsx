import { Heading, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { faqSettingsOf } from "@qticaret/types"
import type { FaqSetting } from "@qticaret/types"
import type { FaqItem, FaqSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import {
  dropTo,
  duplicatedRow,
  isFaqHeadingRow,
  movedRow,
  newHeading,
  newQuestion,
  rowNumbers,
} from "@/features/storefront/layout/faq-rows"
import { SwitchRow } from "../theme-fields"
import { NamedGroup } from "../named-group"
import type { ContentField } from "./content-registry"
import { FaqRow } from "./faq-row"
import type { RowDrag } from "./faq-row"
import { FIELD_IDS } from "./field-registry"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"

const Q = "storefront.editor.faq"

/** The two switches, by setting and label key (the settings search's, `content-registry.ts`). */
const SWITCHES = [
  ["open_first", "openFirst"],
  ["single_open", "singleOpen"],
] as const satisfies readonly (readonly [FaqSetting & ContentField, string])[]

/**
 * Questions and their answers, in order (adr/0049 ek 2026-11-03; adr/0073
 * Ek 2026-11-24 (2)): the shop writes each question and its answer (a
 * short rich text), and may put a heading above a group of them. Rows
 * are dragged by their handle, moved, copied or removed. The storefront
 * shows them and writes no `FAQPage` data (docs/13 §5).
 */
export function FaqForm({ section, problems, onChange }: SectionFormProps<FaqSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<RowDrag["over"]>(null)
  const setItems = (items: FaqItem[], field?: string) => {
    onChange({ ...section, items }, field)
  }
  const full = section.items.length >= L.faq
  const stop = () => {
    setDragged(null)
    setOver(null)
  }
  const drag: RowDrag = {
    dragged,
    over,
    start: setDragged,
    stop,
    hover: (index, place) => {
      const lands = dragged !== null && dropTo(dragged, index, place) !== null
      const next = lands ? { index, place } : null
      if (next?.index !== over?.index || next?.place !== over?.place) {
        setOver(next)
      }
      return lands
    },
    drop: (index, place) => {
      const to = dragged === null ? null : dropTo(dragged, index, place)
      if (dragged !== null && to !== null) {
        setItems(movedRow(section.items, dragged, to))
      }
      stop()
    },
  }
  const numbers = rowNumbers(section.items)
  return (
    <>
      <NamedGroup name="content">
        <TextField
          id={`${section.id}-title`}
          label={t(`${F}.title`)}
          value={section.title}
          max={L.title}
          placeholder={t("storefront.editor.defaults.faq")}
          hint={t(`${F}.titleHint`)}
          error={problem(problems["title"], L.title)}
          onChange={(title) => {
            onChange({ ...section, title }, "title")
          }}
        />
        <ol aria-label={t(`${Q}.items`)} className="flex flex-col gap-3">
          {section.items.map((item, index) => {
            const heading = isFaqHeadingRow(item)
            const number = numbers[index] ?? index + 1
            const name = t(heading ? `${Q}.headingItem` : `${Q}.item`, { number })
            return (
              <FaqRow
                key={index}
                sectionId={section.id}
                item={item}
                index={index}
                count={section.items.length}
                name={name}
                number={number}
                problems={problems}
                drag={drag}
                full={full}
                onChange={(next, field) => {
                  setItems(
                    section.items.map((each, at) => (at === index ? next : each)),
                    field
                  )
                }}
                onMove={(to) => {
                  setItems(movedRow(section.items, index, to))
                }}
                onDuplicate={() => {
                  setItems(duplicatedRow(section.items, index))
                }}
                onRemove={() => {
                  setItems(section.items.filter((_, place) => place !== index))
                }}
              />
            )
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={full}
            onClick={() => {
              setItems([...section.items, newQuestion()])
            }}
          >
            <Plus />
            {t(`${Q}.add`)}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={full}
            onClick={() => {
              setItems([...section.items, newHeading()])
            }}
          >
            <Heading />
            {t(`${Q}.addHeading`)}
          </Button>
          <span className="text-xs text-muted-foreground">{t(`${Q}.hint`, { max: L.faq })}</span>
        </div>
      </NamedGroup>
      {/* How the questions open (bilesen-denetimi (b) 8): both off, as before; closed */}
      <NamedGroup name="opening">
        {SWITCHES.map(([setting, key]) => (
          <div key={setting} id={FIELD_IDS.content(section.id, setting)}>
            <SwitchRow
              id={`${section.id}-${setting}`}
              label={t(`${Q}.${key}`)}
              term={t(`${Q}.${key}Term`)}
              hint={t(`${Q}.${key}Hint`)}
              checked={faqSettingsOf(section)[setting] === "on"}
              onChange={(checked) => {
                onChange({ ...section, [setting]: checked ? "on" : "off" }, setting)
              }}
            />
          </div>
        ))}
      </NamedGroup>
    </>
  )
}
