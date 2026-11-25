import { ChevronLeft, ChevronRight } from "lucide-react"
import { useLayoutEffect, useState } from "react"
import { useWatch } from "react-hook-form"
import type { FieldErrors, UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@qticaret/admin-ui/ui/tabs"
import { useStoreUnits } from "@/features/products/use-units"
import type { MeasureName } from "./measures"
import { CodeFields, MeasureFields, PriceFields, StockFields } from "./variant-fields"
import type { SaleTarget } from "./variant-fields"
import { VariantPictures } from "./variant-pictures"
import { FIELD_TABS, fieldId } from "./variant-values"
import type { StockFacts, VariantField, VariantValues } from "./variant-values"

export type VariantTab = "prices" | "codes" | "pictures"

/** Where the advisor's "Alana git" opens the dialog: a tab and the field for the caret. */
export interface VariantFocus {
  tab: VariantTab
  field: string
}

const D = "products.variant"
const ID = "variant"

const TAB_BODY = "flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"

export interface VariantDialogViewProps {
  form: UseFormReturn<VariantValues>
  /** What the dialog started from: a stored barcode that is not a GTIN is pointed out. */
  saved: VariantValues
  /** Under the title: the variant's values and stock code. */
  description: string
  /** The variant's place among the product's; the arrows go to another, asking first. */
  index: number
  total: number
  onGo: (index: number) => void
  onClose: () => void
  /** Called with the checked values and which fields changed; the parent saves and closes. */
  onValid: (values: VariantValues, dirty: Partial<Record<VariantField, boolean>>) => void
  saving: boolean
  focus?: VariantFocus | null | undefined
  sale: { price: number; struck: number } | null
  stock: StockFacts
  locationId: string | null
  preorder: boolean
  preorderOn: boolean
  /** The product's measures, shown where the variant has none of its own. */
  measures: Partial<Record<MeasureName, number | null | undefined>>
  /** The other variants each picture is tied to, by the picture's key. */
  ties: ReadonlyMap<string, readonly string[]>
  /** Alt texts can be written (a saved product's pictures have media records). */
  alts?: boolean
  /** A saved variant: its sale price under its price (adr/0086). */
  saleTarget?: SaleTarget | null
}

/**
 * Everything about one variant in one dialog (the owner, 2026-11-05:
 * "üzerine tıklarız, modal açılır, … düzenler, girer"): its price and
 * stock, its codes and own parcel, its pictures, in three tabs; the arrows
 * beside the title go to the previous or next variant, asking first when
 * something is not kept. The same dialog on a saved product
 * (`VariantDialog`) and on a new one (the product wizard): only where
 * "Kaydet" puts the values differs.
 */
export function VariantDialogView({
  form,
  saved,
  description,
  index,
  total,
  onGo,
  onClose,
  onValid,
  saving,
  focus,
  sale,
  stock,
  locationId,
  preorder,
  preorderOn,
  measures,
  ties,
  alts = true,
  saleTarget = null,
}: VariantDialogViewProps) {
  const { t } = useTranslation()
  const units = useStoreUnits()
  const guard = useDiscardGuard(form.formState.isDirty)
  const [tab, setTab] = useState<VariantTab>(focus?.tab ?? "prices")
  // A refused field to put the caret in once its tab shows; each refusal is a new one
  const [refused, setRefused] = useState<{ id: string } | null>(null)
  useLayoutEffect(() => {
    if (refused) {
      document.getElementById(refused.id)?.focus()
    }
  }, [refused])
  const images = useWatch({ control: form.control, name: "images" }) as
    VariantValues["images"] | undefined
  const tied = (images ?? []).filter((image) => image.tied)

  const showError = (errors: FieldErrors<VariantValues>) => {
    const field = (Object.keys(FIELD_TABS) as VariantField[]).find((name) => errors[name])
    if (field) {
      setTab(FIELD_TABS[field])
      setRefused({ id: fieldId(field) })
    } else if (errors.images) {
      setTab("pictures")
    }
  }
  const submit = form.handleSubmit((values) => {
    onValid(values, form.formState.dirtyFields)
  }, showError)
  const errors = form.formState.errors
  const flagged = (which: VariantTab) =>
    which === "pictures"
      ? Boolean(errors.images)
      : (Object.keys(FIELD_TABS) as VariantField[]).some(
          (name) => FIELD_TABS[name] === which && errors[name]
        )
  const trigger = (which: VariantTab, label: string) => (
    <TabsTrigger value={which}>
      {label}
      {flagged(which) ? (
        <span className="size-1.5 rounded-full bg-destructive" aria-label={t(`${D}.tabError`)} />
      ) : null}
    </TabsTrigger>
  )
  const go = (to: number) => {
    if (to >= 0 && to < total) {
      guard.guard(() => {
        onGo(to)
      })
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      size="lg"
      pane="fixed"
      className="sm:h-[min(var(--dialog-max-height),40rem)]"
      title={t(`${D}.title`)}
      description={description}
      headerAction={
        total > 1 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === 0 || saving}
              aria-label={t(`${D}.previous`)}
              onClick={() => {
                go(index - 1)
              }}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-10 text-center text-xs text-muted-foreground tabular-nums">
              {t(`${D}.position`, { at: index + 1, total })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === total - 1 || saving}
              aria-label={t(`${D}.next`)}
              onClick={() => {
                go(index + 1)
              }}
            >
              <ChevronRight />
            </Button>
          </>
        ) : null
      }
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      guard={guard}
      initialFocus={focus ? focus.field : null}
    >
      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next as VariantTab)
        }}
        className="flex min-h-0 flex-1 flex-col gap-5"
      >
        <TabsList className="w-full shrink-0 sm:w-fit">
          {trigger("prices", t(`${D}.tabs.prices`))}
          {trigger("codes", t(`${D}.tabs.codes`))}
          {trigger("pictures", t(`${D}.tabs.pictures`, { count: tied.length }))}
        </TabsList>
        <TabsContent value="prices" forceMount className={TAB_BODY}>
          <DialogBody>
            <PriceFields
              form={form}
              idPrefix={ID}
              sale={sale}
              others={total - 1}
              saleTarget={saleTarget}
            />
            <StockFields
              form={form}
              idPrefix={ID}
              stock={stock}
              locationId={locationId}
              preorder={preorder}
              preorderOn={preorderOn}
            />
          </DialogBody>
        </TabsContent>
        <TabsContent value="codes" forceMount className={TAB_BODY}>
          <DialogBody>
            <CodeFields form={form} idPrefix={ID} saved={saved} />
            <MeasureFields form={form} idPrefix={ID} fallback={measures} units={units} />
          </DialogBody>
        </TabsContent>
        <TabsContent value="pictures" forceMount className={TAB_BODY}>
          <DialogBody>
            <VariantPictures form={form} ties={ties} alts={alts} />
          </DialogBody>
        </TabsContent>
      </Tabs>
    </FormDialog>
  )
}
