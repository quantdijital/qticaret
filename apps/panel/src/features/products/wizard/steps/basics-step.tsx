import { Pencil } from "lucide-react"
import { useState } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CategoryTree } from "@/features/products/components/category-tree"
import { VatSelect } from "@/features/products/components/vat-select"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { toSlug } from "@/lib/slug"
import { SUGGESTED_WORDS, wordCount } from "../readiness"
import type { WizardValues } from "../schema"

function UrlField() {
  const { t } = useTranslation()
  const { register, formState, control } = useFormContext<WizardValues>()
  const [editing, setEditing] = useState(false)
  const [title, handle] = useWatch({ control, name: ["title", "handle"] })
  const prefix = useProductPathPrefix()
  const slug = handle.trim() || toSlug(title)
  const error = formState.errors.handle?.message
  return (
    <Field
      label={t("products.wizard.url")}
      htmlFor="product-handle"
      hint={t("products.wizard.urlHint")}
      error={error ? t(error) : undefined}
    >
      {editing ? (
        <Input
          id="product-handle"
          placeholder={toSlug(title)}
          spellCheck={false}
          {...register("handle")}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
          <span className="truncate font-mono text-[13px] text-muted-foreground">
            {prefix}
            <span className="text-foreground">{slug || "…"}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(true)
            }}
          >
            <Pencil />
            {t("common.edit")}
          </Button>
        </div>
      )}
    </Field>
  )
}

function CategoryPicker() {
  const { control } = useFormContext<WizardValues>()
  return (
    <Controller
      control={control}
      name="category_ids"
      render={({ field }) => <CategoryTree value={field.value} onChange={field.onChange} />}
    />
  )
}

function VatPicker() {
  const { t } = useTranslation()
  const { control } = useFormContext<WizardValues>()
  return (
    <Controller
      control={control}
      name="type_id"
      render={({ field }) => (
        <Field
          label={t("products.wizard.vat")}
          htmlFor="product-vat"
          hint={t("products.wizard.vatHint")}
        >
          <VatSelect id="product-vat" value={field.value} onChange={field.onChange} />
        </Field>
      )}
    />
  )
}

/** Step 1: what the product is called, its URL, its story and where it belongs. */
export function BasicsStep() {
  const { t } = useTranslation()
  const { register, formState, control } = useFormContext<WizardValues>()
  const description = useWatch({ control, name: "description" })
  const words = wordCount(description)
  const titleError = formState.errors.title?.message
  return (
    <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
      <SectionCard title={t("products.wizard.basics.card")} className="xl:col-span-8">
        <div className="flex flex-col gap-5">
          <Field
            label={t("products.wizard.title")}
            htmlFor="product-title"
            required
            error={titleError ? t(titleError) : undefined}
          >
            <Input
              id="product-title"
              autoFocus
              placeholder={t("products.wizard.titlePlaceholder")}
              {...register("title")}
            />
          </Field>
          <UrlField />
          <Field
            label={t("products.wizard.descriptionLabel")}
            htmlFor="product-description"
            hint={t("products.wizard.words", { count: words, suggested: SUGGESTED_WORDS })}
          >
            <Textarea
              id="product-description"
              className="min-h-52"
              placeholder={t("products.wizard.descriptionPlaceholder")}
              {...register("description")}
            />
          </Field>
        </div>
      </SectionCard>
      <SectionCard title={t("products.wizard.organize")} className="xl:col-span-4">
        <div className="flex flex-col gap-5">
          <Field label={t("products.wizard.categories")} hint={t("products.wizard.categoriesHint")}>
            <CategoryPicker />
          </Field>
          <VatPicker />
        </div>
      </SectionCard>
    </div>
  )
}
