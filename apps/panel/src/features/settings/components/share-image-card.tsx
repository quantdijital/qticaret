import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { MediaField } from "@/components/patterns/media-field"
import { useSaveSection } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const S = "settings.seo.shareImage"

/**
 * The shop's share image (F12.10, docs/13 §8): what a link to a page with
 * no image of its own shows on WhatsApp, Instagram or X. Chosen from the
 * media library like a page's cover.
 */
export function ShareImageCard({ saved }: { saved: SeoSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<SeoSettings>("seo")
  const initial = { image: saved.default_og_image ?? "" }
  const form = useForm({ values: initial, resetOptions: { keepDirtyValues: true } })
  const url = useWatch({ control: form.control, name: "image" })
  const submit = form.handleSubmit((values) => {
    save.mutate(
      { default_og_image: values.image || null },
      {
        onSuccess: (result) => {
          form.reset({ image: result.values.default_og_image ?? "" }, FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${S}.title`)}
      description={t(`${S}.hint`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(initial, FULL_RESET)
      }}
    >
      <MediaField
        id="share-image"
        label={t(`${S}.title`)}
        hint={t(`${S}.size`)}
        value={url || null}
        frame="share"
        inline
        hideLabel
        emptyText={t(`${S}.none`)}
        onChange={(asset) => {
          form.setValue("image", asset?.url ?? "", { shouldDirty: true })
        }}
      />
    </CardForm>
  )
}
