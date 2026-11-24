import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react"
import type { DragEvent } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { MediaField } from "@/components/patterns/media-field"
import { RichEditor } from "@/features/content/editor/rich-editor"
import type { DropPlace } from "@/features/attributes/definition-list"
import { PROGRAM_LIMITS, PROGRAM_TAGS } from "@/features/products/api/program"
import { autoLabelKey, toggledTags } from "./program-values"
import type { ProgramValues } from "./program-values"

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
 * One step of the program: its label (empty: numbered by the unit), its
 * title, a short text, a picture of the media library and what it
 * includes. Dragged by its handle; the arrows move it for a keyboard.
 */
export function ProgramStepRow({
  index,
  count,
  drag,
  onMove,
  onRemove,
}: {
  index: number
  count: number
  drag: StepDrag
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { control, register, formState } = useFormContext<ProgramValues>()
  const unit = useWatch({ control, name: "unit" })
  const base = `steps.${index}` as const
  const errors = formState.errors.steps?.[index]
  const id = `program-step-${String(index)}`
  const auto = t(autoLabelKey(unit), { n: index + 1 })
  return (
    <li
      className={cn(
        "relative flex flex-col gap-4 rounded-md border bg-card p-4",
        drag.dragging && "opacity-50",
        drag.over === "before" && "border-t-2 border-t-primary",
        drag.over === "after" && "border-b-2 border-b-primary"
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
      <div className="flex items-center gap-2">
        <span
          draggable
          role="presentation"
          className="cursor-grab text-muted-foreground"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move"
            drag.onStart()
          }}
          onDragEnd={drag.onEnd}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold">{auto}</span>
        <div className="ms-auto flex gap-1">
          <Button
            type="button"
            size="icon"
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
            size="icon"
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
            size="icon"
            variant="ghost"
            className="text-destructive"
            aria-label={t(`${P}.remove`, { n: index + 1 })}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-label`}>{t(`${P}.label`)}</Label>
          <Input
            id={`${id}-label`}
            placeholder={auto}
            maxLength={PROGRAM_LIMITS.label}
            {...register(`${base}.label`)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-title`}>{t(`${P}.stepTitle`)}</Label>
          <Input
            id={`${id}-title`}
            maxLength={PROGRAM_LIMITS.title}
            aria-invalid={errors?.title ? true : undefined}
            placeholder={t(`${P}.titlePlaceholder`)}
            {...register(`${base}.title`)}
          />
          {errors?.title?.message ? (
            <p className="text-sm text-destructive">{t(errors.title.message)}</p>
          ) : null}
        </div>
      </div>
      <Controller
        control={control}
        name={`${base}.body`}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
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
              <p className="text-sm text-destructive">{t(fieldState.error.message)}</p>
            ) : null}
          </div>
        )}
      />
      <Controller
        control={control}
        name={`${base}.image`}
        render={({ field }) => (
          <MediaField
            id={`${id}-image`}
            label={t(`${P}.image`)}
            hint={t(`${P}.imageHint`)}
            value={field.value?.url ?? null}
            emptyText={t(`${P}.noImage`)}
            onChange={(asset) => {
              field.onChange(asset ? { url: asset.url, alt: asset.alt ?? null } : null)
            }}
          />
        )}
      />
      <Controller
        control={control}
        name={`${base}.tags`}
        render={({ field }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t(`${P}.tags`)}</legend>
            <div className="flex flex-wrap gap-2">
              {PROGRAM_TAGS.map((tag) => {
                const on = field.value.includes(tag)
                return (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant={on ? "secondary" : "outline"}
                    aria-pressed={on}
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
    </li>
  )
}
