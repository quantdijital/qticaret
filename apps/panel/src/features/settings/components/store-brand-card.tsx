import type { AppearanceSettings } from "@qticaret/types"
import type { ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { MediaField } from "@/components/patterns/media-field"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSaveAppearance } from "@/features/settings/api/appearance"
import { useRenameStore } from "@/features/settings/api/store"
import { StoreFaviconField } from "@/features/settings/components/store-favicon-field"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const B = "settings.store.brand"

interface Values {
  name: string
  logo_light_url: string
  logo_dark_url: string
  favicon_url: string
}

const valuesOf = (name: string, appearance: AppearanceSettings): Values => ({
  name,
  logo_light_url: appearance.logo_light_url ?? "",
  logo_dark_url: appearance.logo_dark_url ?? "",
  favicon_url: appearance.favicon_url ?? "",
})

type Tone = "light" | "dark"

// Each logo on the ground it is made for, in either theme of the panel
const GROUND: Record<Tone, string> = {
  light: "bg-card text-muted-foreground dark:bg-foreground dark:text-background/70",
  dark: "bg-foreground text-background/70 dark:bg-card dark:text-muted-foreground",
}

/** One logo on its ground: chosen from the media library, replaced or taken off. */
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
  return (
    <MediaField
      id={`store-logo-${tone}`}
      label={t(`${B}.${tone}`)}
      hint={t(`${B}.${tone}Hint`)}
      value={url || null}
      frame="logo"
      svg
      ground={GROUND[tone]}
      emptyText={t(`${B}.none`)}
      onChange={(asset) => {
        onChange(asset?.url ?? "")
      }}
    />
  )
}

/** A part of the card under its own small heading. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t pt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

/**
 * The shop's brand (adr/0048): its name, its logos and the storefront's
 * site icon, each picture shown as it will be seen. The storefront,
 * e-mails and Google read them, and `{mağaza_adı}` shows the name. The
 * name is Medusa's store record, the pictures the appearance section's;
 * one save.
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
  const saveImages = useSaveAppearance()
  const values = valuesOf(name, appearance)
  const form = useForm<Values>({ values, resetOptions: { keepDirtyValues: true } })
  const { dirtyFields, errors } = form.formState
  const [light, dark, favicon, typedName] = useWatch({
    control: form.control,
    name: ["logo_light_url", "logo_dark_url", "favicon_url", "name"],
  })
  const setImage = (field: "logo_light_url" | "logo_dark_url" | "favicon_url", url: string) => {
    form.setValue(field, url, { shouldDirty: true })
  }

  const submit = form.handleSubmit(async (next) => {
    try {
      const renamed = dirtyFields.name
        ? await rename.mutateAsync({ id: storeId, name: next.name.trim() })
        : null
      const logos =
        dirtyFields.logo_light_url || dirtyFields.logo_dark_url
          ? {
              logo_light_url: next.logo_light_url || null,
              logo_dark_url: next.logo_dark_url || null,
            }
          : {}
      const icon = dirtyFields.favicon_url ? { favicon_url: next.favicon_url || null } : {}
      const images =
        Object.keys(logos).length + Object.keys(icon).length > 0
          ? await saveImages.mutateAsync({ ...logos, ...icon })
          : null
      form.reset(valuesOf(renamed?.store.name ?? name, images?.values ?? appearance), FULL_RESET)
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
      saving={rename.isPending || saveImages.isPending}
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
      <Group title={t(`${B}.logos`)}>
        <div className="@container">
          <div className="grid gap-5 @md:grid-cols-2">
            <LogoSlot
              tone="light"
              url={light}
              onChange={(url) => {
                setImage("logo_light_url", url)
              }}
            />
            <LogoSlot
              tone="dark"
              url={dark}
              onChange={(url) => {
                setImage("logo_dark_url", url)
              }}
            />
          </div>
        </div>
      </Group>
      <Group title={t(`${B}.favicon.title`)}>
        <StoreFaviconField
          url={favicon}
          name={typedName.trim() || name}
          onChange={(url) => {
            setImage("favicon_url", url)
          }}
        />
      </Group>
    </CardForm>
  )
}
