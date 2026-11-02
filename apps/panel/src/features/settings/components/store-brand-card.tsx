import type { AppearanceSettings } from "@qticaret/types"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IMAGE_ACCEPT, uploadContentImage } from "@/features/content/editor/upload"
import { useSaveAppearance } from "@/features/settings/api/appearance"
import { useRenameStore } from "@/features/settings/api/store"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { cn } from "@/lib/utils"

const B = "settings.store.brand"

interface Values {
  name: string
  logo_light_url: string
  logo_dark_url: string
}

const valuesOf = (name: string, appearance: AppearanceSettings): Values => ({
  name,
  logo_light_url: appearance.logo_light_url ?? "",
  logo_dark_url: appearance.logo_dark_url ?? "",
})

type Tone = "light" | "dark"

// Each logo on the ground it is made for, in either theme of the panel
const GROUND: Record<Tone, string> = {
  light: "bg-card text-muted-foreground dark:bg-foreground dark:text-background/70",
  dark: "bg-foreground text-background/70 dark:bg-card dark:text-muted-foreground",
}

/** One logo: what it looks like on its ground, and its upload, replace and remove. */
function LogoSlot({
  tone,
  url,
  onChange,
}: {
  tone: Tone
  url: string
  onChange: (url: string) => void
}) {
  const { t } = useTranslation()
  const picker = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const upload = async (file: File | undefined) => {
    if (!file) {
      return
    }
    setUploading(true)
    try {
      onChange(await uploadContentImage(file))
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium">{t(`${B}.${tone}`)}</span>
      <div
        className={cn(
          "flex h-24 items-center justify-center rounded-md border p-3 text-xs",
          GROUND[tone]
        )}
      >
        {url ? (
          <img src={url} alt={t(`${B}.${tone}`)} className="max-h-full max-w-full object-contain" />
        ) : (
          t(`${B}.none`)
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t(`${B}.${tone}Hint`)}</p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={picker}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          aria-label={t(`${B}.choose`, { logo: t(`${B}.${tone}`) })}
          onChange={(event) => {
            void upload(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => picker.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {t(url ? `${B}.replace` : `${B}.upload`)}
        </Button>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t(`${B}.removeOf`, { logo: t(`${B}.${tone}`) })}
            onClick={() => {
              onChange("")
            }}
          >
            <Trash2 />
            {t(`${B}.remove`)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The shop's name and logos (adr/0048): the storefront, e-mails and
 * Google read them, and `{mağaza_adı}` shows the name. The name is
 * Medusa's store record, the logos the appearance section's; one save.
 */
export function StoreBrandCard({
  storeId,
  name,
  appearance,
  className,
}: {
  storeId: string
  name: string
  appearance: AppearanceSettings
  className?: string
}) {
  const { t } = useTranslation()
  const rename = useRenameStore()
  const saveLogos = useSaveAppearance()
  const values = valuesOf(name, appearance)
  const form = useForm<Values>({ values, resetOptions: { keepDirtyValues: true } })
  const { dirtyFields, errors } = form.formState
  const light = useWatch({ control: form.control, name: "logo_light_url" })
  const dark = useWatch({ control: form.control, name: "logo_dark_url" })

  const submit = form.handleSubmit(async (next) => {
    try {
      const renamed = dirtyFields.name
        ? await rename.mutateAsync({ id: storeId, name: next.name.trim() })
        : null
      const logos =
        dirtyFields.logo_light_url || dirtyFields.logo_dark_url
          ? await saveLogos.mutateAsync({
              logo_light_url: next.logo_light_url || null,
              logo_dark_url: next.logo_dark_url || null,
            })
          : null
      form.reset(valuesOf(renamed?.store.name ?? name, logos?.values ?? appearance), FULL_RESET)
      toast.success(t("settings.saved"))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <CardForm
      title={t(`${B}.title`)}
      description={t(`${B}.description`)}
      className={className}
      dirty={form.formState.isDirty}
      saving={rename.isPending || saveLogos.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <Field
        label={t(`${B}.name`)}
        htmlFor="store-name"
        required
        error={errors.name ? t(`${B}.nameRequired`) : undefined}
      >
        <Input
          id="store-name"
          {...form.register("name", { validate: (text) => text.trim().length > 0 })}
        />
      </Field>
      <div className="@container">
        <div className="grid gap-5 @md:grid-cols-2">
          <LogoSlot
            tone="light"
            url={light}
            onChange={(url) => {
              form.setValue("logo_light_url", url, { shouldDirty: true })
            }}
          />
          <LogoSlot
            tone="dark"
            url={dark}
            onChange={(url) => {
              form.setValue("logo_dark_url", url, { shouldDirty: true })
            }}
          />
        </div>
      </div>
    </CardForm>
  )
}
