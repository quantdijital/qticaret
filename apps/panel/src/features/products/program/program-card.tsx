import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { ChevronsDownUp, ChevronsUpDown, Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FieldHints } from "@qticaret/admin-ui/hooks/use-field-hints"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { useDirtyEntry } from "@qticaret/admin-ui/patterns/dirty-registry"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { dropIndex } from "@/features/attributes/definition-list"
import type { DropPlace } from "@/features/attributes/definition-list"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { PROGRAM_LIMITS, programQuery, useSaveProgram } from "@/features/products/api/program"
import type { Program } from "@/features/products/api/program"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { allToggled, movedOpen, removedOpen, toggledOpen } from "./program-open"
import type { OpenSteps } from "./program-open"
import { ProgramStepRow } from "./program-step"
import { ProgramUnitChoice } from "./program-unit"
import { newStep, programOf, programSchema, valuesOf } from "./program-values"
import type { ProgramValues } from "./program-values"

const P = "products.program"

/** The element the advisor's "Alana git" lands on (P-CONT-10). */
export const PROGRAM_TARGET = "product-program"

/** From this many steps on, one button opens or folds them all. */
const ALL_FROM = 3

/**
 * The steps' editor, on its card: add, remove, reorder, write; saved
 * whole, or put back as they were. Each step folds to one line; a new one
 * comes open, and a save refused for a step opens it.
 */
export function ProgramEditor({ productId, program }: { productId: string; program: Program }) {
  const { t } = useTranslation()
  const save = useSaveProgram(productId)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ProgramValues>({
    resolver: zodResolver(programSchema),
    defaultValues: valuesOf(program),
  })
  const unit = useWatch({ control: form.control, name: "unit" })
  const steps = useFieldArray({ control: form.control, name: "steps", keyName: "rowKey" })
  const [open, setOpen] = useState<OpenSteps>(new Set())
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<{ at: number; place: DropPlace } | null>(null)
  const count = steps.fields.length
  const endDrag = () => {
    setDragged(null)
    setOver(null)
  }
  const move = (from: number, to: number) => {
    steps.move(from, to)
    setOpen((was) => movedOpen(was, count, from, to))
  }
  const submit = form.handleSubmit(
    (values) => {
      const settle = beginSave(form)
      setFailure(null)
      save.mutate(programOf(values), {
        onSuccess: (answer) => {
          settle(valuesOf(answer.program))
          toast.success(t("products.detail.saved"))
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      })
    },
    (errors) => {
      // A folded step's mistake would not show: the steps with one open
      const wrong = Array.isArray(errors.steps)
        ? errors.steps.flatMap((error: unknown, index) => (error ? [index] : []))
        : []
      setOpen((was) => new Set([...was, ...wrong]))
    }
  )
  const dirty = form.formState.isDirty
  const putBack = () => {
    setFailure(null)
    form.reset(valuesOf(program), FULL_RESET)
  }
  // The product page's header save saves it too
  useDirtyEntry({
    dirty,
    saving: save.isPending,
    submit: () => void submit(),
    reset: putBack,
  })
  const allOpen = count > 0 && steps.fields.every((_, index) => open.has(index))
  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.description`)}
      action={
        <ProgramUnitChoice
          value={unit}
          onChange={(next) => {
            form.setValue("unit", next, { shouldDirty: true })
          }}
        />
      }
    >
      <FormProvider {...form}>
        <form
          aria-label={t(`${P}.title`)}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {count === 0 ? <EmptyState text={t(`${P}.empty`)} /> : null}
          {count > 0 ? (
            <ol className="flex flex-col gap-1.5">
              {steps.fields.map((field, index) => (
                <ProgramStepRow
                  key={field.rowKey}
                  index={index}
                  count={count}
                  open={open.has(index)}
                  onToggle={() => {
                    setOpen((was) => toggledOpen(was, index))
                  }}
                  onMove={(to) => {
                    move(index, to)
                  }}
                  onRemove={() => {
                    steps.remove(index)
                    setOpen((was) => removedOpen(was, index))
                  }}
                  drag={{
                    dragging: dragged === index,
                    over: over?.at === index && dragged !== index ? over.place : null,
                    onStart: () => {
                      setDragged(index)
                    },
                    onEnd: endDrag,
                    onOver: (place) => {
                      setOver({ at: index, place })
                    },
                    onDrop: (place) => {
                      if (dragged !== null) {
                        move(dragged, dropIndex(dragged, index, place))
                      }
                      endDrag()
                    },
                  }}
                />
              ))}
            </ol>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={count >= PROGRAM_LIMITS.steps}
              onClick={() => {
                steps.append(newStep(), { focusName: `steps.${String(count)}.title` })
                setOpen((was) => new Set([...was, count]))
              }}
            >
              <Plus aria-hidden="true" />
              {t(`${P}.addOf.${unit}`)}
            </Button>
            {count >= ALL_FROM ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ms-auto text-muted-foreground"
                onClick={() => {
                  setOpen((was) => allToggled(was, count))
                }}
              >
                {allOpen ? (
                  <ChevronsDownUp aria-hidden="true" />
                ) : (
                  <ChevronsUpDown aria-hidden="true" />
                )}
                {t(allOpen ? `${P}.closeAll` : `${P}.openAll`)}
              </Button>
            ) : null}
          </div>
          {count >= PROGRAM_LIMITS.steps ? (
            <p className="text-xs text-muted-foreground">
              {t(`${P}.limit`, { max: PROGRAM_LIMITS.steps })}
            </p>
          ) : null}
          {failure ? (
            <p role="alert" className="text-sm text-destructive-text">
              {failure}
            </p>
          ) : null}
          {dirty || save.isPending ? (
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="cancel"
                size="sm"
                disabled={save.isPending}
                onClick={putBack}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                {t("common.save")}
              </Button>
            </div>
          ) : null}
        </form>
      </FormProvider>
    </SectionCard>
  )
}

function ProgramBody({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const program = useQuery(programQuery(productId))
  return (
    // The card's sentence behind an (i) beside its title (the owner, 2026-11-28)
    <FieldHints style="tip">
      <div id={PROGRAM_TARGET}>
        {program.data ? (
          <ProgramEditor productId={productId} program={program.data.program} />
        ) : (
          <SectionCard title={t(`${P}.title`)} description={t(`${P}.description`)}>
            {program.isError ? (
              <ErrorState
                text={errorText(t, program.error)}
                onRetry={() => void program.refetch()}
              />
            ) : (
              <LoadingRows />
            )}
          </SectionCard>
        )}
      </div>
    </FieldHints>
  )
}

/**
 * "Program" (adr/0078): a dated product's steps, a day or a lesson each,
 * shown on its page by the design's program section. Only while the
 * shop's dated products are on and this product is sold by departure.
 */
export function ProgramCard({ productId }: { productId: string }) {
  const catalog = useQuery(productCatalogQuery(productId))
  const flagOn = useFeature(BOOKING_FLAG)
  if (!flagOn || catalog.data?.booking_mode !== "departure") {
    return null
  }
  return <ProgramBody productId={productId} />
}
