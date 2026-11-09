import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { FormDialog } from "@/components/patterns/form-dialog"
import { SearchPicker } from "@/components/patterns/search-picker"
import type { PickerOption } from "@/components/patterns/search-picker"
import { useRevealTarget } from "@/components/patterns/use-section-open"
import { DialogBody } from "@/components/ui/dialog"
import { brandOptions, useSetProductBrand } from "@/features/brands/api/brands"
import { collectionOptions } from "@/features/collections/api/collections"
import { findingsNote } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { CategoryTree } from "@/features/products/components/category-tree"
import { VatSelect } from "@/features/products/components/vat-select"
import { vatLabelOf, vatRatesQuery } from "@/features/settings/api/vat-rates"
import { errorText } from "@/lib/errors"
import { PRODUCT_SECTIONS, someNames } from "./sections"
import { SideCard } from "./side-card"

interface Values {
  category_ids: string[]
  type_id: string
  brand: PickerOption | null
  collection: PickerOption | null
}

// The brand comes through a link (F3.11): Medusa's product type does not name it
const brandOf = (product: ProductDetail): PickerOption | null => {
  const brand = (product as { brand?: { id: string; name: string } | null }).brand
  return brand ? { id: brand.id, label: brand.name } : null
}

const collectionOf = (product: ProductDetail): PickerOption | null =>
  product.collection ? { id: product.collection.id, label: product.collection.title } : null

const savedOf = (product: ProductDetail): Values => ({
  category_ids: (product.categories ?? []).map((category) => category.id),
  type_id: product.type?.id ?? "",
  brand: brandOf(product),
  collection: collectionOf(product),
})

/** Categories, brand, collection and KDV group in a dialog; each saved where it is kept. */
function OrganizeDialog({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const setBrand = useSetProductBrand(product.id)
  const form = useForm<Values>({ defaultValues: savedOf(product) })

  const submit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState
    try {
      if (dirtyFields.category_ids || dirtyFields.type_id || dirtyFields.collection) {
        await update.mutateAsync({
          ...(dirtyFields.category_ids || dirtyFields.type_id
            ? {
                categories: values.category_ids.map((id) => ({ id })),
                type_id: values.type_id || null,
              }
            : {}),
          ...(dirtyFields.collection ? { collection_id: values.collection?.id ?? null } : {}),
        })
      }
      if (dirtyFields.brand) {
        await setBrand.mutateAsync(values.brand?.id ?? null)
      }
      toast.success(t("products.detail.saved"))
      onClose()
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("products.detail.organize")}
      description={t("products.side.organizeHint")}
      dirty={form.formState.isDirty}
      saving={update.isPending || setBrand.isPending}
      onSubmit={() => void submit()}
    >
      <DialogBody>
        <Field label={t("products.wizard.categories")} hint={t("products.wizard.categoriesHint")}>
          <Controller
            control={form.control}
            name="category_ids"
            render={({ field }) => <CategoryTree value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label={t("brands.field")} htmlFor="detail-brand" hint={t("brands.fieldHint")}>
          <Controller
            control={form.control}
            name="brand"
            render={({ field }) => (
              <SearchPicker
                id="detail-brand"
                value={field.value}
                onChange={field.onChange}
                search={brandOptions}
                queryKey={["brands", "options"]}
                placeholder={t("brands.pick")}
                empty={t("brands.noneFound")}
                inactiveNote={t("brands.inactive")}
              />
            )}
          />
        </Field>
        <Field
          label={t("collections.field")}
          htmlFor="detail-collection"
          hint={t("collections.fieldHint")}
        >
          <Controller
            control={form.control}
            name="collection"
            render={({ field }) => (
              <SearchPicker
                id="detail-collection"
                value={field.value}
                onChange={field.onChange}
                search={collectionOptions}
                queryKey={["collections", "options"]}
                placeholder={t("collections.pick")}
                empty={t("collections.noneFound")}
                inactiveNote={t("collections.inactive")}
              />
            )}
          />
        </Field>
        <Field
          label={t("products.wizard.vat")}
          htmlFor="detail-vat"
          hint={t("products.wizard.vatHint")}
        >
          <Controller
            control={form.control}
            name="type_id"
            render={({ field }) => (
              <VatSelect id="detail-vat" value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>
      </DialogBody>
    </FormDialog>
  )
}

/**
 * Where the product is listed, under which brand and in which collection,
 * and which KDV group it is taxed in, in the page's narrow column (docs/06
 * "Ürün sayfası"): a line each, "Düzenle" opens them in a dialog, as does the advisor's
 * "Alana git" for a missing category or brand.
 */
export function OrganizeCard({
  product,
  findings,
}: {
  product: ProductDetail
  /** The advisor's findings for it, counted under its facts. */
  findings?: SectionFindings
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  useRevealTarget(PRODUCT_SECTIONS.organize, () => {
    setOpen(true)
  })
  const rates = useQuery(vatRatesQuery()).data
  const saved = savedOf(product)
  const rate = saved.type_id
    ? rates?.rates.find((each) => each.product_type_id === saved.type_id)
    : rates?.default
  const categories = (product.categories ?? []).map((category) => category.name)
  return (
    <SideCard
      id={PRODUCT_SECTIONS.organize}
      title={t("products.detail.organize")}
      rows={[
        {
          label: t("products.wizard.categories"),
          value:
            categories.length > 0 ? someNames(categories, 3) : t("products.sections.noCategory"),
          empty: categories.length === 0,
        },
        {
          label: t("brands.field"),
          value: saved.brand?.label ?? t("products.sections.noBrand"),
          empty: !saved.brand,
        },
        {
          label: t("collections.field"),
          value: saved.collection?.label ?? t("collections.none"),
          empty: !saved.collection,
        },
        { label: t("products.wizard.vat"), value: rate ? vatLabelOf(rate) : "—" },
      ]}
      findings={findings && findingsNote(t, findings)}
      onEdit={() => {
        setOpen(true)
      }}
    >
      {open ? (
        <OrganizeDialog
          product={product}
          onClose={() => {
            setOpen(false)
          }}
        />
      ) : null}
    </SideCard>
  )
}
