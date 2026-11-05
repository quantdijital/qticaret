import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useLayoutEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@/components/patterns/form-dialog"
import { useDiscardGuard } from "@/components/patterns/use-discard-guard"
import { Button } from "@/components/ui/button"
import { DialogBody } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PriceDisplayView } from "@/features/products/api/price-history"
import type { ProductDetail } from "@/features/products/api/products"
import { useStoreUnits } from "@/features/products/use-units"
import { errorText } from "@/lib/errors"
import type { CatalogVariant } from "./variant-codes"
import { variantFacts } from "./variant-facts"
import { CodeFields, MeasureFields, PriceFields, StockFields } from "./variant-fields"
import { VariantPictures } from "./variant-pictures"
import { useSaveVariant } from "./variant-save"
import { FIELD_TABS, fieldId, savedVariant, variantSchemaFor } from "./variant-values"
import type { Variant, VariantField, VariantValues } from "./variant-values"

export type VariantTab = "prices" | "codes" | "pictures"

/** Where the advisor's "Alana git" opens the dialog: a tab and the field for the caret. */
export interface VariantFocus {
  tab: VariantTab
  field: string
}

const D = "products.variant"
const ID = "variant"

const TAB_BODY = "flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"

interface VariantDialogProps {
  product: ProductDetail
  /** The product's variants in their order: the arrows walk through them. */
  variants: readonly Variant[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  locationId: string | null
  catalog: ReadonlyMap<string, CatalogVariant>
  displays: ReadonlyMap<string, PriceDisplayView | null>
  preorder: boolean
  preorderOn: boolean
  focus?: VariantFocus | null
}

/**
 * Everything about one variant in one dialog (the owner, 2026-11-05:
 * "üzerine tıklarız, modal açılır, … düzenler, girer"): its price and
 * stock, its codes and own parcel, its pictures and their alt texts, in
 * three tabs; the arrows beside the title go to the previous or next
 * variant, asking first when something is not saved. "Kaydet" saves it
 * all and closes.
 */
export function VariantDialog({
  product,
  variants,
  index,
  onIndexChange,
  onClose,
  locationId,
  catalog,
  displays,
  preorder,
  preorderOn,
  focus,
}: VariantDialogProps) {
  const { t } = useTranslation()
  const units = useStoreUnits()
  const variant = variants[index] ?? variants[0]
  const savedFor = (each: Variant) => savedVariant(product, each, locationId, catalog.get(each.id))
  // What the dialog started from, kept while it is open: the product is read again behind it
  // (pictures settling), and only what differs from this is sent
  const [saved, setSaved] = useState<VariantValues | null>(() =>
    variant ? savedFor(variant) : null
  )
  const form = useForm<VariantValues>({
    ...(saved ? { resolver: zodResolver(variantSchemaFor(saved)), defaultValues: saved } : {}),
  })
  const save = useSaveVariant(product, locationId)
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

  if (!variant || !saved) {
    return null
  }
  const facts = variantFacts(
    product,
    variant,
    locationId,
    catalog.get(variant.id),
    displays.get(variant.id)
  )
  const go = (to: number) => {
    const next = variants[to]
    if (!next) {
      return
    }
    guard.guard(() => {
      const start = savedFor(next)
      setSaved(start)
      form.reset(start)
      onIndexChange(to)
    })
  }
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
    const dirty = form.formState.dirtyFields as Partial<Record<VariantField, boolean>>
    save.mutate(
      { variant, values, saved, dirty },
      {
        onSuccess: () => {
          toast.success(t(`${D}.saved`))
          onClose()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
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

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      size="lg"
      pane
      className="sm:h-[min(var(--dialog-max-height),40rem)]"
      title={t(`${D}.title`)}
      description={[facts.name, facts.sku].filter(Boolean).join(" · ")}
      headerAction={
        variants.length > 1 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === 0 || save.isPending}
              aria-label={t(`${D}.previous`)}
              onClick={() => {
                go(index - 1)
              }}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-10 text-center text-xs text-muted-foreground tabular-nums">
              {t(`${D}.position`, { at: index + 1, total: variants.length })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === variants.length - 1 || save.isPending}
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
      saving={save.isPending}
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
            <PriceFields form={form} idPrefix={ID} sale={facts.sale} others={variants.length - 1} />
            <StockFields
              form={form}
              idPrefix={ID}
              variant={variant}
              locationId={locationId}
              preorder={preorder}
              preorderOn={preorderOn}
            />
          </DialogBody>
        </TabsContent>
        <TabsContent value="codes" forceMount className={TAB_BODY}>
          <DialogBody>
            <CodeFields form={form} idPrefix={ID} saved={saved} />
            <MeasureFields form={form} idPrefix={ID} product={product} units={units} />
          </DialogBody>
        </TabsContent>
        <TabsContent value="pictures" forceMount className={TAB_BODY}>
          <DialogBody>
            <VariantPictures form={form} product={product} variantId={variant.id} />
          </DialogBody>
        </TabsContent>
      </Tabs>
    </FormDialog>
  )
}
