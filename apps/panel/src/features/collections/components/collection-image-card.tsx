import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { MediaField } from "@/components/patterns/media-field"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSetCollectionDetails } from "@/features/collections/api/collections"
import type { Collection, CollectionImage } from "@/features/collections/api/collections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const I = "collections.image"
// The media library's alt text limit (backend lib/media ALT_MAX)
const ALT_MAX = 250

interface Values {
  url: string
  alt: string
}

const valuesOf = (image: CollectionImage | null): Values => ({
  url: image?.url ?? "",
  alt: image?.alt ?? "",
})

/**
 * The collection's picture: the top of its storefront page shows it, and
 * a share has it when the page has no share image of its own. Chosen
 * through the standard media entry with its alt text beside it, saved on
 * its own.
 */
export function CollectionImageCard({ collection }: { collection: Collection }) {
  const { t } = useTranslation()
  const save = useSetCollectionDetails(collection.id)
  const initial = valuesOf(collection.image)
  const form = useForm<Values>({ values: initial, resetOptions: { keepDirtyValues: true } })
  const url = useWatch({ control: form.control, name: "url" })
  const submit = form.handleSubmit((values) => {
    const image = values.url ? { url: values.url, alt: values.alt.trim() || null } : null
    save.mutate(
      { image },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.collection.image), FULL_RESET)
          toast.success(t(`${I}.saved`))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
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
        id="collection-image"
        label={t(`${I}.title`)}
        value={url || null}
        frame="wide"
        hideLabel
        emptyText={t(`${I}.add`)}
        onChange={(asset) => {
          form.setValue("url", asset?.url ?? "", { shouldDirty: true })
          // A library image's own alt text fills an empty one
          if (asset?.alt && !form.getValues("alt").trim()) {
            form.setValue("alt", asset.alt, { shouldDirty: true })
          }
        }}
      >
        <Field label={t(`${I}.alt`)} htmlFor="collection-image-alt" hint={t(`${I}.altHint`)}>
          <Input id="collection-image-alt" maxLength={ALT_MAX} {...form.register("alt")} />
        </Field>
      </MediaField>
    </CardForm>
  )
}
