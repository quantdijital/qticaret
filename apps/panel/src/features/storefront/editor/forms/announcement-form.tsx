import { useTranslation } from "react-i18next"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import { ListFooter, RowActions, RowCell } from "@/features/settings/components/storefront-rows"
import type { AnnouncementBar } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { AnnouncementMode } from "./announcement-settings"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"

const A = "storefront.editor.announcement"

/**
 * The thin bar on top of every page: its lines, each may hold the shop's
 * details, and once there are several how they show (only the first, taking
 * turns, side by side; docs/tema/bilesen-denetimi (b) 6). How they turn
 * stands in the open "Hareket" group (`AnnouncementMotion`).
 */
export function AnnouncementForm({
  section,
  problems,
  onChange,
}: SectionFormProps<AnnouncementBar>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const setLines = (lines: string[], field?: string) => {
    onChange({ ...section, lines }, field)
  }
  const setLine = (index: number, text: string) => {
    setLines(
      section.lines.map((line, at) => (at === index ? text : line)),
      `lines.${String(index)}`
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {section.lines.map((line, index) => {
          const number = index + 1
          const id = `announcement-line-${String(index)}`
          const error = problem(problems[`lines.${String(index)}`], L.line)
          return (
            <li key={index} className="flex items-start gap-1">
              <RowCell error={error} errorId={`${id}-error`} className="flex-1">
                <TokenSlot
                  fieldId={id}
                  onInsert={(text) => {
                    setLine(index, text)
                  }}
                >
                  <Input
                    id={id}
                    value={line}
                    maxLength={L.line}
                    aria-label={t(`${A}.line`, { number })}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    placeholder={t(`${A}.placeholder`)}
                    className="pr-9"
                    onChange={(event) => {
                      setLine(index, event.target.value)
                    }}
                  />
                </TokenSlot>
                <ShopTokenPreview text={line} />
              </RowCell>
              <RowActions
                index={index}
                count={section.lines.length}
                item={t(`${A}.line`, { number })}
                removable={section.lines.length > 1}
                onMove={(to) => {
                  const next = section.lines.filter((_, at) => at !== index)
                  next.splice(to, 0, line)
                  setLines(next)
                }}
                onRemove={() => {
                  setLines(section.lines.filter((_, at) => at !== index))
                }}
              />
            </li>
          )
        })}
      </ol>
      <ListFooter
        label={t(`${A}.add`)}
        hint={t(`${A}.hint`, { max: L.lines, length: L.line })}
        full={section.lines.length >= L.lines}
        onAdd={() => {
          setLines([...section.lines, ""])
        }}
      />
      <AnnouncementMode section={section} onChange={onChange} />
    </div>
  )
}
