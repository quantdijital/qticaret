import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { MediaField } from "@/components/patterns/media-field"
import { useSaveSection } from "@/features/settings/api/sections"
import type { StoreSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const Q = "settings.store.etbisQr"

/**
 * The QR code ETBİS gives a registered shop (eticaret.gov.tr): the
 * storefront's footer shows it beside the legal identity. Optional; a
 * picture of the media library on a white ground, as it is printed.
 */
export function EtbisQrCard({ saved, className }: { saved: StoreSettings; className?: string }) {
  const { t } = useTranslation()
  const save = useSaveSection<StoreSettings>("store")
  const initial = { url: saved.etbis_qr_url ?? "" }
  const form = useForm({ values: initial, resetOptions: { keepDirtyValues: true } })
  const url = useWatch({ control: form.control, name: "url" })
  const submit = form.handleSubmit((values) => {
    save.mutate(
      { etbis_qr_url: values.url || null },
      {
        onSuccess: (result) => {
          form.reset({ url: result.values.etbis_qr_url ?? "" }, FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${Q}.title`)}
      description={t(`${Q}.hint`)}
      className={className}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(initial, FULL_RESET)
      }}
    >
      <MediaField
        id="etbis-qr"
        label={t(`${Q}.title`)}
        hint={t(`${Q}.size`)}
        value={url || null}
        frame="square"
        // Cameras read dark modules on white, whatever the theme; empty, the theme's dashed frame
        {...(url ? { ground: "bg-white" } : {})}
        inline
        hideLabel
        emptyText={t(`${Q}.none`)}
        onChange={(asset) => {
          form.setValue("url", asset?.url ?? "", { shouldDirty: true })
        }}
      />
    </CardForm>
  )
}
