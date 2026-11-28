import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Trash2 } from "lucide-react"
import type { DragEvent } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RichEditor } from "@/features/content/editor/rich-editor"
import type { DropPlace } from "@/features/attributes/definition-list"
import { PROGRAM_LIMITS, PROGRAM_TAGS } from "@/features/products/api/program"
import { autoLabelKey, toggledTags } from "./program-values"
import type { ProgramValues } from "./program-values"
import { StepImage } from "./step-image"

const P = "products.program"

/** The list's drag state as one step sees it. */
export interface StepDrag {
  dragging: boolean
  over: DropPlace | null
  onStart: () => void
  onEnd: () => void
  onOver: (place: DropPlace) => void
  onDrop: (place: DropPlace) => void
}

// The upper half of a step drops before it, the lower half after
const placeOf = (event: DragEvent<HTMLElement>): DropPlace => {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "before" : "after"
}

/**
 * One step of the program, folded to a line by default (the owner,
 * 2026-11-28: a long tour's days are scanned, then one is opened): its
 * label (empty: numbered by the unit), its title, a thumbnail of its
 * picture and how many things it includes. The line opens it; open, its
 * label, title, short text, picture and what it includes are edited.
 * Dragged by its handle; the arrows move it for a keyboard.
 */
export function ProgramStepRow({
  index,
  count,
  open,
  onToggle,
  drag,
  onMove,
  onRemove,
}: {
  index: number
  count: number
  open: boolean
  onToggle: () => void
  drag: StepDrag
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { control, register, formState } = useFormContext<ProgramValues>()
  const unit = useWatch({ control, name: "unit" })
  const base = `steps.${index}` as const
  const step = useWatch({ control, name: base })
  const errors = formState.errors.steps?.[index]
  const id = `program-step-${String(index)}`
  const auto = t(autoLabelKey(unit), { n: index + 1 })
  const label = step.label.trim() === "" ? auto : step.label.trim()
  const title = step.title.trim()
  return (
    <li
      className={cn(
        "rounded-md border bg-card",
        drag.dragging && "opacity-50",
        drag.over === "before" && "border-t-2 border-t-primary",
        drag.over === "after" && "border-b-2 border-b-primary",
        errors && "border-destructive"
      )}
      onDragOver={(event) => {
        event.preventDefault()
        drag.onOver(placeOf(event))
      }}
      onDrop={(event) => {
        event.preventDefault()
        drag.onDrop(placeOf(event))
      }}
    >
      {/* The whole line opens the step: the toggle's hit area covers it, the handle and buttons sit above */}
      <div className="relative flex min-h-11 items-center gap-2 px-2 py-1.5">
        <span
          draggable
          role="presentation"
          className="relative z-10 cursor-grab p-1 text-muted-foreground"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move"
            drag.onStart()
          }}
          onDragEnd={drag.onEnd}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-baseline gap-2 text-left outline-hidden after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-ring"
        >
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
          <span
            className={cn(
              "truncate text-sm font-medium",
              title === "" && "font-normal text-muted-foreground italic"
            )}
          >
            {title === "" ? t(`${P}.untitled`) : title}
          </span>
        </button>
        <span aria-hidden="true" className="flex shrink-0 items-center gap-2">
          {step.tags.length > 0 ? (
            <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
              {t(`${P}.tagCount`, { count: step.tags.length })}
            </span>
          ) : null}
          {step.image ? (
            <img
              src={step.image.url}
              alt=""
              className="size-8 rounded-sm border object-cover"
              loading="lazy"
            />
          ) : null}
        </span>
        {/* On a phone a folded line keeps its width for the title: the buttons show once it is open */}
        <div
          className={cn("relative z-10 shrink-0 items-center", open ? "flex" : "hidden sm:flex")}
        >
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t(`${P}.moveUp`, { n: index + 1 })}
            disabled={index === 0}
            onClick={() => {
              onMove(index - 1)
            }}
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t(`${P}.moveDown`, { n: index + 1 })}
            disabled={index === count - 1}
            onClick={() => {
              onMove(index + 1)
            }}
          >
            <ArrowDown className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-destructive-text"
            aria-label={t(`${P}.remove`, { n: index + 1 })}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </div>
      {open ? (
        <div id={`${id}-body`} className="flex flex-col gap-3 border-t px-3 pt-3 pb-3">
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-label`} className="text-xs">
                {t(`${P}.label`)}
              </Label>
              <Input
                id={`${id}-label`}
                placeholder={auto}
                maxLength={PROGRAM_LIMITS.label}
                {...register(`${base}.label`)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-title`} className="text-xs">
                {t(`${P}.stepTitle`)}
              </Label>
              <Input
                id={`${id}-title`}
                maxLength={PROGRAM_LIMITS.title}
                aria-invalid={errors?.title ? true : undefined}
                placeholder={t(`${P}.titlePlaceholder`)}
                {...register(`${base}.title`)}
              />
              {errors?.title?.message ? (
                <p className="text-xs text-destructive-text">{t(errors.title.message)}</p>
              ) : null}
            </div>
          </div>
          <Controller
            control={control}
            name={`${base}.body`}
            render={({ field, fieldState }) => (
              // Three lines high while empty, growing with its text
              <div className="flex flex-col gap-1 [&_.qt-prose]:min-h-20 [&_.qt-prose]:py-2.5">
                <RichEditor
                  value={field.value}
                  onChange={field.onChange}
                  label={t(`${P}.body`)}
                  media={false}
                  bare
                  short
                  maxChars={PROGRAM_LIMITS.bodyChars}
                  placeholder={t(`${P}.bodyPlaceholder`)}
                />
                {fieldState.error?.message ? (
                  <p className="text-xs text-destructive-text">{t(fieldState.error.message)}</p>
                ) : null}
              </div>
            )}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-8">
            <Controller
              control={control}
              name={`${base}.image`}
              render={({ field }) => (
                <StepImage id={`${id}-image`} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name={`${base}.tags`}
              render={({ field }) => (
                <fieldset className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t(`${P}.tags`)}
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {PROGRAM_TAGS.map((tag) => {
                      const on = field.value.includes(tag)
                      return (
                        <Button
                          key={tag}
                          type="button"
                          size="xs"
                          variant={on ? "secondary" : "outline"}
                          aria-pressed={on}
                          className={cn("h-7 rounded-full px-2.5", on && "ring-1 ring-primary/40")}
                          onClick={() => {
                            field.onChange(toggledTags(field.value, tag))
                          }}
                        >
                          {t(`${P}.tagNames.${tag}`)}
                        </Button>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            />
          </div>
        </div>
      ) : null}
    </li>
  )
}
