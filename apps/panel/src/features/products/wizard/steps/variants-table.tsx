import { SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { WizardValues } from "../schema"
import { draftName, ownImageUrls } from "../variant-draft"
import { VariantDraftDialog } from "./variant-draft-dialog"

// A row's fields in the order their refusals are told: the table's, then the dialog's
const ROW_FIELDS = [
  "price",
  "stock",
  "sku",
  "ean",
  "cost",
  "mpn",
  "weight",
  "length",
  "width",
  "height",
] as const

function PriceInput({ index, label }: { index: number; label: string }) {
  const { register } = useFormContext<WizardValues>()
  return (
    <NumberField
      decimals={2}
      min={0}
      suffix="₺"
      aria-label={label}
      placeholder="0,00"
      {...register(`variants.${index}.price`)}
    />
  )
}

/** A product without options: one price, one stock, one code. */
export function SingleVariant() {
  const { t } = useTranslation()
  const { register, formState } = useFormContext<WizardValues>()
  const manage = useWatch<WizardValues, "manage_inventory">({ name: "manage_inventory" })
  const errors = formState.errors.variants?.[0]
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <Field label={t("products.wizard.price")} required error={message(errors?.price?.message)}>
        <PriceInput index={0} label={t("products.wizard.price")} />
      </Field>
      <Field
        label={t("products.detail.cost")}
        htmlFor="variant-cost"
        error={message(errors?.cost?.message)}
        hint={t("products.detail.costHint")}
      >
        <NumberField
          id="variant-cost"
          decimals={2}
          min={0}
          suffix="₺"
          placeholder="—"
          {...register("variants.0.cost")}
        />
      </Field>
      <Field
        label={t("products.wizard.stock")}
        htmlFor="variant-stock"
        error={message(errors?.stock?.message)}
        hint={manage ? undefined : t("products.wizard.stockUntracked")}
      >
        <NumberField
          id="variant-stock"
          min={0}
          disabled={!manage}
          {...register("variants.0.stock")}
        />
      </Field>
      <Field
        label={t("products.wizard.sku")}
        htmlFor="variant-sku"
        error={message(errors?.sku?.message)}
      >
        <Input id="variant-sku" spellCheck={false} {...register("variants.0.sku")} />
      </Field>
      <Field
        label={t("products.wizard.ean")}
        htmlFor="variant-ean"
        error={message(errors?.ean?.message)}
      >
        <Input id="variant-ean" inputMode="numeric" {...register("variants.0.ean")} />
      </Field>
      <Field
        label={t("products.detail.codes.mpn")}
        htmlFor="variant-mpn"
        error={message(errors?.mpn?.message)}
      >
        <Input id="variant-mpn" spellCheck={false} {...register("variants.0.mpn")} />
      </Field>
    </div>
  )
}

function BulkPrice() {
  const { t } = useTranslation()
  const { getValues, setValue } = useFormContext<WizardValues>()
  const [text, setText] = useState("")
  const valid = (parseMoneyInput(text) ?? 0) > 0
  const apply = () => {
    getValues("variants").forEach((_, index) => {
      setValue(`variants.${index}.price`, text, { shouldDirty: true, shouldValidate: true })
    })
    setText("")
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{t("products.wizard.bulkPrice")}</span>
      <NumberField
        size="compact"
        decimals={2}
        min={0}
        suffix="₺"
        value={text}
        placeholder="0,00"
        aria-label={t("products.wizard.bulkPrice")}
        className="w-36"
        onChange={(event) => {
          setText(event.target.value)
        }}
      />
      <Button type="button" size="sm" variant="outline" disabled={!valid} onClick={apply}>
        {t("products.wizard.applyAll")}
      </Button>
    </div>
  )
}

/**
 * One row per combination: price, stock and codes side by side; its last
 * button opens the variant's dialog (the product page's) for its cost,
 * MPN, own parcel and pictures.
 */
export function VariantsTable() {
  const { t } = useTranslation()
  const { register, formState, control } = useFormContext<WizardValues>()
  const [variants, manage, images] = useWatch({
    control,
    name: ["variants", "manage_inventory", "images"],
  })
  const [open, setOpen] = useState<number | null>(null)
  const rowError = (index: number) => {
    const errors = formState.errors.variants?.[index]
    // A refused value in the dialog's fields (cost, MPN, parcel) is told here too
    const key = ROW_FIELDS.map((field) => errors?.[field]?.message).find(Boolean)
    return key ? t(key) : null
  }
  const headClass = "px-3 py-2 text-left text-xs font-medium text-muted-foreground"
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {t("products.wizard.variantCount", { count: variants.length })}
        </p>
        <BulkPrice />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[50rem] text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className={headClass}>{t("products.wizard.variant")}</th>
              <th className={cn(headClass, "w-44")}>{t("products.wizard.price")}</th>
              <th className={cn(headClass, "w-36")}>{t("products.wizard.stock")}</th>
              <th className={cn(headClass, "w-40")}>{t("products.wizard.sku")}</th>
              <th className={cn(headClass, "w-40")}>{t("products.wizard.ean")}</th>
              <th className={cn(headClass, "w-36")}>
                <span className="sr-only">{t("products.wizard.variantMore")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const error = rowError(index)
              const own = ownImageUrls(variant, images)
              return (
                <tr key={variant.key} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1 pt-1.5">
                      {own[0] ? (
                        <img
                          src={own[0]}
                          alt=""
                          className="size-6 shrink-0 rounded border object-cover"
                        />
                      ) : null}
                      {Object.values(variant.options).map((value) => (
                        <span
                          key={value}
                          className="rounded-md bg-accent px-1.5 py-0.5 text-xs text-accent-foreground"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                    {error ? (
                      <p role="alert" className="mt-1 text-xs text-destructive-text">
                        {error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <PriceInput
                      index={index}
                      label={`${variant.title} ${t("products.wizard.price")}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <NumberField
                      min={0}
                      disabled={!manage}
                      aria-label={`${variant.title} ${t("products.wizard.stock")}`}
                      {...register(`variants.${index}.stock`)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      spellCheck={false}
                      aria-label={`${variant.title} ${t("products.wizard.sku")}`}
                      {...register(`variants.${index}.sku`)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      inputMode="numeric"
                      aria-label={`${variant.title} ${t("products.wizard.ean")}`}
                      {...register(`variants.${index}.ean`)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      aria-haspopup="dialog"
                      aria-label={t("products.wizard.variantMoreLabel", {
                        name: draftName(variant),
                      })}
                      onClick={() => {
                        setOpen(index)
                      }}
                    >
                      <SlidersHorizontal />
                      {own.length > 0
                        ? t("products.wizard.variantPictureCount", { count: own.length })
                        : t("products.wizard.variantMore")}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {open === null ? null : (
        <VariantDraftDialog
          index={open}
          onIndexChange={setOpen}
          onClose={() => {
            setOpen(null)
          }}
        />
      )}
    </div>
  )
}
