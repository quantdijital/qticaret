import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import { AiPicks } from "@/features/ai/components/ai-picks"
import { brandOptions, useSetProductBrand } from "@/features/brands/api/brands"
import { collectionOptions } from "@/features/collections/api/collections"
import { useCollectionsOn } from "@/features/collections/api/flag"
import { findingsNote } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { CategoryTree } from "@/features/products/components/category-tree"
import { VatSelect } from "@/features/products/components/vat-select"
import { vatLabelOf, vatRatesQuery } from "@/features/settings/api/vat-rates"
import { errorText } from "@/lib/errors"
import { TagsField } from "./organize-tags"
import { dropTags, tagIds, tagsOf } from "./tag-values"
import type { TagValue } from "./tag-values"
import { PRODUCT_SECTIONS, someNames } from "./sections"
import { SideCard } from "./side-card"
import type { SideRow } from "./side-card"
import { SideForm } from "./side-form"

interface Values {
  category_ids: string[]
  type_id: string
  brand: PickerOption | null
  collection: PickerOption | null
  tags: TagValue[]
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
  tags: tagsOf(product),
})

/**
 * Categories, tags, brand, collection and KDV group, in the card's place;
 * each saved where it is kept. Beside categories and tags the AI picks from
 * the shop's own lists (adr/0074 §5 madde 2); a pick only fills the form.
 */
function OrganizeForm({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const setBrand = useSetProductBrand(product.id)
  // Collections off: the field is not offered; the product keeps the one it has
  const collectionsOn = useCollectionsOn()
  const form = useForm<Values>({ defaultValues: savedOf(product) })

  const submit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState
    // Tags this save created, until the product's update links them (#251 D1)
    let created: string[] = []
    try {
      if (
        dirtyFields.category_ids ||
        dirtyFields.type_id ||
        dirtyFields.collection ||
        dirtyFields.tags
      ) {
        // A new tag the person picked is created only now, then linked like the shop's own
        const picked = dirtyFields.tags ? await tagIds(values.tags) : null
        created = picked?.created ?? []
        const tags = picked ? picked.ids.map((id) => ({ id })) : null
        await update.mutateAsync({
          ...(dirtyFields.category_ids || dirtyFields.type_id
            ? {
                categories: values.category_ids.map((id) => ({ id })),
                type_id: values.type_id || null,
              }
            : {}),
          ...(dirtyFields.collection ? { collection_id: values.collection?.id ?? null } : {}),
          ...(tags ? { tags } : {}),
        })
        created = []
      }
      if (dirtyFields.brand) {
        await setBrand.mutateAsync(values.brand?.id ?? null)
      }
      toast.success(t("products.detail.saved"))
      onClose()
    } catch (failure) {
      // The update failed: a tag it would have linked is not left behind unused
      await dropTags(created)
      toast.error(errorText(t, failure))
    }
  })

  return (
    <SideForm
      label={t("products.detail.organize")}
      hint={t("products.side.organizeHint")}
      dirty={form.formState.isDirty}
      saving={update.isPending || setBrand.isPending}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <Field label={t("products.wizard.categories")} hint={t("products.wizard.categoriesHint")}>
        <Controller
          control={form.control}
          name="category_ids"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <AiPicks
                task="product_category"
                entity={{ type: "product", id: product.id }}
                label={t("products.detail.aiCategories")}
                has={(pick) => pick.kind === "record" && field.value.includes(pick.id)}
                onPick={(pick) => {
                  if (pick.kind === "record" && !field.value.includes(pick.id)) {
                    field.onChange([...field.value, pick.id])
                  }
                }}
              />
              <CategoryTree value={field.value} onChange={field.onChange} />
            </div>
          )}
        />
      </Field>
      <Field label={t("products.tags.field")} hint={t("products.tags.hint")}>
        <Controller
          control={form.control}
          name="tags"
          render={({ field }) => (
            <TagsField productId={product.id} value={field.value} onChange={field.onChange} />
          )}
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
      {collectionsOn ? (
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
      ) : null}
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
    </SideForm>
  )
}

/**
 * Where the product is listed, under which brand and in which collection,
 * and which KDV group it is taxed in, in the page's narrow column (docs/06
 * "Ürün sayfası"): a line each; "Düzenle" turns the card into their form,
 * as does the advisor's "Alana git" for a missing category or brand.
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
  const [editing, setEditing] = useState(false)
  useRevealTarget(PRODUCT_SECTIONS.organize, () => {
    setEditing(true)
  })
  const rates = useQuery(vatRatesQuery()).data
  const collectionsOn = useCollectionsOn()
  const saved = savedOf(product)
  const rate = saved.type_id
    ? rates?.rates.find((each) => each.product_type_id === saved.type_id)
    : rates?.default
  const categories = (product.categories ?? []).map((category) => category.name)
  const tags = saved.tags.map((tag) => tag.value)
  // `unset`: optional and empty, named once under the facts
  const rows: (SideRow & { unset?: boolean })[] = [
    {
      label: t("products.wizard.categories"),
      value: categories.length > 0 ? someNames(categories, 3) : t("products.sections.noCategory"),
      empty: categories.length === 0,
    },
    { label: t("brands.field"), value: saved.brand?.label ?? "", unset: !saved.brand },
    ...(collectionsOn
      ? [
          {
            label: t("collections.field"),
            value: saved.collection?.label ?? "",
            unset: !saved.collection,
          },
        ]
      : []),
    { label: t("products.tags.field"), value: someNames(tags, 3), unset: tags.length === 0 },
    { label: t("products.wizard.vat"), value: rate ? vatLabelOf(rate) : "—" },
  ]
  const unset = rows.filter((row) => row.unset)
  return (
    <SideCard
      id={PRODUCT_SECTIONS.organize}
      title={t("products.detail.organize")}
      rows={rows.filter((row) => !row.unset)}
      // What is not set yet (no brand, no tags) in one line, not a line each
      note={
        unset.length > 0
          ? t("products.side.unset", { names: unset.map((row) => row.label).join(", ") })
          : undefined
      }
      findings={findings && findingsNote(t, findings)}
      editing={editing}
      onEdit={() => {
        setEditing(true)
      }}
    >
      <OrganizeForm
        product={product}
        onClose={() => {
          setEditing(false)
        }}
      />
    </SideCard>
  )
}
