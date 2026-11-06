import { useQuery } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { MediaField } from "@/components/patterns/media-field"
import { Input } from "@/components/ui/input"
import { categoryImagesQuery, useSetCategoryImage } from "@/features/categories/api/images"
import type { CategoryImage } from "@/features/categories/api/images"
import { errorText } from "@/lib/errors"
import { CategoryImageFallback } from "./category-image-fallback"
import { FULL_RESET } from "@/lib/forms"

const I = "categories.image"
// The media library's alt text limit (backend lib/media ALT_MAX)
const ALT_MAX = 250

interface Values {
  url: string
  alt: string
}

const valuesOf = (image: CategoryImage | null): Values => ({
  url: image?.url ?? "",
  alt: image?.alt ?? "",
})

function Form({ categoryId, saved }: { categoryId: string; saved: CategoryImage | null }) {
  const { t } = useTranslation()
  const save = useSetCategoryImage(categoryId)
  const initial = valuesOf(saved)
  const form = useForm<Values>({ values: initial, resetOptions: { keepDirtyValues: true } })
  const url = useWatch({ control: form.control, name: "url" })
  const submit = form.handleSubmit((values) => {
    const image = values.url ? { url: values.url, alt: values.alt.trim() || null } : null
    save.mutate(image, {
      onSuccess: (result) => {
        form.reset(valuesOf(result.image), FULL_RESET)
        toast.success(t(`${I}.saved`))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  return (
    <CardForm
      title={t(`${I}.title`)}
      description={t(`${I}.hint`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(initial, FULL_RESET)
      }}
    >
      <MediaField
        id="category-image"
        label={t(`${I}.title`)}
        value={url || null}
        hint={t(`${I}.frameHint`)}
        frame="tile"
        inline
        hideLabel
        emptyText={t(`${I}.add`)}
        emptyAside={<CategoryImageFallback categoryId={categoryId} />}
        onChange={(asset) => {
          form.setValue("url", asset?.url ?? "", { shouldDirty: true })
          // A library image's own alt text fills an empty one
          if (asset?.alt && !form.getValues("alt").trim()) {
            form.setValue("alt", asset.alt, { shouldDirty: true })
          }
        }}
      >
        <Field label={t(`${I}.alt`)} htmlFor="category-image-alt" hint={t(`${I}.altHint`)}>
          <Input id="category-image-alt" maxLength={ALT_MAX} {...form.register("alt")} />
        </Field>
      </MediaField>
    </CardForm>
  )
}

/**
 * A category's picture (adr/0046 Ek 2026-11-04): the storefront's
 * category cards and menu show it. Optional, as the storefront falls back
 * to the category's newest product photo; shown in the storefront tile's
 * own 4:5 frame, chosen through the standard media entry with its alt
 * text beside it, saved on its own.
 */
export function CategoryImageCard({ categoryId }: { categoryId: string }) {
  const query = useQuery(categoryImagesQuery())
  if (!query.data) {
    return null
  }
  return (
    <Form key={categoryId} categoryId={categoryId} saved={query.data.get(categoryId) ?? null} />
  )
}
