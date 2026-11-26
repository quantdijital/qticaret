import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { useDirtyEntry } from "@qticaret/admin-ui/patterns/dirty-registry"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { dropIndex } from "@/features/attributes/definition-list"
import type { DropPlace } from "@/features/attributes/definition-list"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import {
  PROGRAM_LIMITS,
  PROGRAM_UNITS,
  programQuery,
  useSaveProgram,
} from "@/features/products/api/program"
import type { Program } from "@/features/products/api/program"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { ProgramStepRow } from "./program-step"
import { newStep, programOf, programSchema, valuesOf } from "./program-values"
import type { ProgramValues } from "./program-values"

const P = "products.program"

/** The element the advisor's "Alana git" lands on (P-CONT-10). */
export const PROGRAM_TARGET = "product-program"

/** The steps' editor: add, remove, reorder, write; saved whole, or put back as they were. */
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
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<{ at: number; place: DropPlace } | null>(null)
  const count = steps.fields.length
  const endDrag = () => {
    setDragged(null)
    setOver(null)
  }
  const submit = form.handleSubmit((values) => {
    setFailure(null)
    save.mutate(programOf(values), {
      onSuccess: (answer) => {
        form.reset(valuesOf(answer.program), FULL_RESET)
        toast.success(t("products.detail.saved"))
      },
      onError: (error) => {
        setFailure(errorText(t, error))
      },
    })
  })
  const dirty = form.formState.isDirty
  // The product page's save bar saves it too
  useDirtyEntry({
    dirty,
    saving: save.isPending,
    submit: () => void submit(),
    reset: () => {
      setFailure(null)
      form.reset(valuesOf(program), FULL_RESET)
    },
  })
  return (
    <FormProvider {...form}>
      <form
        aria-label={t(`${P}.title`)}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t(`${P}.unit`)}</legend>
          <RadioGroup
            className="flex gap-4"
            value={unit}
            onValueChange={(next) => {
              form.setValue("unit", next as ProgramValues["unit"], { shouldDirty: true })
            }}
          >
            {PROGRAM_UNITS.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <RadioGroupItem id={`program-unit-${option}`} value={option} />
                <Label htmlFor={`program-unit-${option}`}>{t(`${P}.units.${option}`)}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        {count === 0 ? <EmptyState text={t(`${P}.empty`)} /> : null}
        {count > 0 ? (
          <ol className="flex flex-col gap-3">
            {steps.fields.map((field, index) => (
              <ProgramStepRow
                key={field.rowKey}
                index={index}
                count={count}
                onMove={(to) => {
                  steps.move(index, to)
                }}
                onRemove={() => {
                  steps.remove(index)
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
                      steps.move(dragged, dropIndex(dragged, index, place))
                    }
                    endDrag()
                  },
                }}
              />
            ))}
          </ol>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={count >= PROGRAM_LIMITS.steps}
          onClick={() => {
            steps.append(newStep(), { focusName: `steps.${String(count)}.title` })
          }}
        >
          <Plus aria-hidden="true" />
          {t(`${P}.add`)}
        </Button>
        {count >= PROGRAM_LIMITS.steps ? (
          <p className="text-sm text-muted-foreground">
            {t(`${P}.limit`, { max: PROGRAM_LIMITS.steps })}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
        {dirty || save.isPending ? (
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="cancel"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setFailure(null)
                form.reset(valuesOf(program), FULL_RESET)
              }}
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
  )
}

function ProgramBody({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const program = useQuery(programQuery(productId))
  return (
    <div id={PROGRAM_TARGET}>
      <SectionCard title={t(`${P}.title`)} description={t(`${P}.description`)}>
        {program.isPending ? <LoadingRows /> : null}
        {program.isError ? (
          <ErrorState text={errorText(t, program.error)} onRetry={() => void program.refetch()} />
        ) : null}
        {program.data ? (
          <ProgramEditor productId={productId} program={program.data.program} />
        ) : null}
      </SectionCard>
    </div>
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
