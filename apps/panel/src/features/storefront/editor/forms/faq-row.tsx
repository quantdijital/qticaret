import { Copy, GripVertical } from "lucide-react"
import type { DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { FAQ_LIMITS } from "@qticaret/types"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { FaqItem } from "@/features/storefront/api/layout"
import { answerDoc, isFaqHeadingRow, withAnswer } from "@/features/storefront/layout/faq-rows"
import type { DropPlace } from "@/features/storefront/layout/faq-rows"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { FaqAnswerField } from "./faq-answer-field"
import { TextField } from "./fields"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"

const Q = "storefront.editor.faq"

/** The upper half of a row drops before it, the lower half after. */
const placeOf = (event: DragEvent<HTMLElement>): DropPlace => {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "before" : "after"
}

/** The list's drag and drop, by each row's handle (native, as the footer tree's). */
export interface RowDrag {
  dragged: number | null
  over: { index: number; place: DropPlace } | null
  start: (index: number) => void
  hover: (index: number, place: DropPlace) => boolean
  drop: (index: number, place: DropPlace) => void
  stop: () => void
}

/**
 * One row of an FAQ (adr/0073 Ek 2026-11-24 (2)): a question and its
 * answer, or a group's heading; dragged by its handle, moved up or down,
 * copied or removed by its buttons.
 */
export function FaqRow({
  sectionId,
  item,
  index,
  count,
  name,
  number,
  problems,
  drag,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  full,
}: {
  sectionId: string
  item: FaqItem
  index: number
  count: number
  /** The row's name for its buttons: "3. soru", "2. başlık". */
  name: string
  /** Its number among its kind. */
  number: number
  problems: SectionProblems
  drag: RowDrag
  onChange: (item: FaqItem, field: string) => void
  onMove: (to: number) => void
  onDuplicate: () => void
  onRemove: () => void
  /** The list holds all it may: no copy. */
  full: boolean
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const at = `items.${String(index)}`
  const over = drag.over?.index === index ? drag.over.place : null
  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 rounded-md border p-3",
        isFaqHeadingRow(item) && "bg-muted/40",
        drag.dragged === index && "opacity-50"
      )}
      onDragOver={(event) => {
        if (drag.hover(index, placeOf(event))) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        drag.drop(index, placeOf(event))
      }}
    >
      {over ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-1 z-10 h-0.5 bg-primary",
            over === "before" ? "-top-2" : "-bottom-2"
          )}
        />
      ) : null}
      <div className="flex items-center gap-1">
        <span
          draggable
          aria-hidden="true"
          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move"
            event.dataTransfer.setData("text/plain", String(index))
            const row = event.currentTarget.closest("li")
            if (row) {
              event.dataTransfer.setDragImage(row, 16, 16)
            }
            drag.start(index)
          }}
          onDragEnd={drag.stop}
        >
          <GripVertical className="size-3.5" />
        </span>
        <span className="flex-1 text-sm font-medium">{name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={full}
          aria-label={t(`${Q}.duplicate`, { item: name })}
          onClick={onDuplicate}
        >
          <Copy />
        </Button>
        <RowActions
          index={index}
          count={count}
          item={name}
          removable={count > 1}
          onMove={onMove}
          onRemove={onRemove}
        />
      </div>
      {isFaqHeadingRow(item) ? (
        <TextField
          id={PREVIEW_IDS.text(sectionId, `${at}.heading`)}
          label={t(`${Q}.headingText`)}
          value={item.heading}
          max={FAQ_LIMITS.heading}
          required
          hint={t(`${Q}.headingHint`)}
          error={problem(problems[`${at}.heading`], FAQ_LIMITS.heading)}
          onChange={(heading) => {
            onChange({ heading: heading ?? "" }, `${at}.heading`)
          }}
        />
      ) : (
        <>
          <TextField
            id={PREVIEW_IDS.text(sectionId, `${at}.question`)}
            label={t(`${Q}.question`, { number })}
            value={item.question}
            max={FAQ_LIMITS.question}
            required
            error={problem(problems[`${at}.question`], FAQ_LIMITS.question)}
            onChange={(question) => {
              onChange({ ...item, question: question ?? "" }, `${at}.question`)
            }}
          />
          <FaqAnswerField
            id={PREVIEW_IDS.text(sectionId, `${at}.answer`)}
            label={t(`${Q}.answer`, { number })}
            question={item.question}
            body={answerDoc(item)}
            error={problem(problems[`${at}.answer`], FAQ_LIMITS.answerChars)}
            onChange={(body) => {
              onChange(withAnswer(item, body), `${at}.answer`)
            }}
          />
        </>
      )}
    </li>
  )
}
