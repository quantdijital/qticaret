import { zodResolver } from "@hookform/resolvers/zod"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Select, Text, Textarea } from "@medusajs/ui"
import { Controller, useForm } from "react-hook-form"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { SeoSettings } from "../../../../modules/platform-settings/sections"
import { ErrorState, LoadingRows } from "../../../components/page-states"
import { errorText } from "../../../lib/errors"
import { seoFormSchema, toForm } from "./form-schema"
import type { SeoForm } from "./form-schema"
import { TemplateField } from "./template-field"
import { useSeoSettings } from "./use-seo-settings"
import type { SeoSave } from "./use-seo-settings"

/** Settings > SEO (F2.3, docs/13): canonical host, URL style, templates, robots.txt. */
function SeoSettingsPage() {
  const { t } = useTranslation()
  const { query, save } = useSeoSettings()
  const { data, isPending, isError, error, refetch } = query

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">{t("qticaret.settings.seo.title")}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t("qticaret.settings.seo.subtitle")}
        </Text>
      </div>
      {isPending || isError ? (
        <div className="px-6 py-4">
          {isPending ? (
            <LoadingRows rows={6} />
          ) : (
            <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
          )}
        </div>
      ) : (
        // Mounted once the values are here, so no field starts out empty; a
        // new version (this save or another admin's) starts a fresh form
        <SeoSettingsForm key={data.version} values={data.values} save={save} />
      )}
    </Container>
  )
}

function SeoSettingsForm({ values, save }: { values: SeoSettings; save: SeoSave }) {
  const { t } = useTranslation()
  const form = useForm<SeoForm>({
    resolver: zodResolver(seoFormSchema),
    defaultValues: toForm(values),
  })

  return (
    <form
      className="divide-y"
      onSubmit={(event) => {
        void form.handleSubmit((submitted) => {
          save.mutate(submitted)
        })(event)
      }}
    >
      <HostAndUrls control={form.control} />
      <Templates control={form.control} />
      <Robots control={form.control} />
      <div className="flex justify-end gap-2 px-6 py-4">
        <Button
          type="button"
          variant="secondary"
          disabled={!form.formState.isDirty || save.isPending}
          onClick={() => {
            form.reset()
          }}
        >
          {t("qticaret.common.reset")}
        </Button>
        <Button type="submit" disabled={!form.formState.isDirty} isLoading={save.isPending}>
          {t("qticaret.common.save")}
        </Button>
      </div>
    </form>
  )
}

function HostAndUrls({ control }: { control: Control<SeoForm> }) {
  const { t } = useTranslation()
  const entities = ["product", "category", "brand"] as const
  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <Heading level="h2">{t("qticaret.settings.seo.urls.title")}</Heading>
      <Controller
        control={control}
        name="canonical_host"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="seo-host" size="small" weight="plus">
              {t("qticaret.settings.seo.host.label")}
            </Label>
            <Input id="seo-host" placeholder="magaza.com.tr" {...field} />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t("qticaret.settings.seo.host.hint")}
            </Text>
          </div>
        )}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {entities.map((entity) => (
          <Controller
            key={entity}
            control={control}
            name={`url_style.${entity}`}
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  {t(`qticaret.settings.seo.urls.${entity}`)}
                </Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {(["prefixed", "flat"] as const).map((style) => (
                      <Select.Item key={style} value={style}>
                        {t(`qticaret.settings.seo.urls.styles.${entity}.${style}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
          />
        ))}
      </div>
    </section>
  )
}

function Templates({ control }: { control: Control<SeoForm> }) {
  const { t } = useTranslation()
  const titles = ["product", "category", "brand"] as const
  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <Heading level="h2">{t("qticaret.settings.seo.templates.title")}</Heading>
      {titles.map((entity) => (
        <Controller
          key={entity}
          control={control}
          name={`title_templates.${entity}`}
          render={({ field, fieldState }) => (
            <TemplateField
              id={`seo-title-${entity}`}
              label={t(`qticaret.settings.seo.templates.${entity}`)}
              entity={entity}
              serpField="title"
              value={field.value}
              error={fieldState.error?.message}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      ))}
      <Controller
        control={control}
        name="description_templates.product"
        render={({ field, fieldState }) => (
          <TemplateField
            id="seo-description-product"
            label={t("qticaret.settings.seo.templates.descriptionProduct")}
            entity="product"
            serpField="description"
            multiline
            value={field.value}
            error={fieldState.error?.message}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
    </section>
  )
}

function Robots({ control }: { control: Control<SeoForm> }) {
  const { t } = useTranslation()
  const presets = ["ai_search_visible", "block_training", "none"] as const
  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <Heading level="h2">{t("qticaret.settings.seo.robots.title")}</Heading>
      <Controller
        control={control}
        name="ai_crawler_preset"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus">
              {t("qticaret.settings.seo.robots.aiPreset")}
            </Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {presets.map((preset) => (
                  <Select.Item key={preset} value={preset}>
                    {t(`qticaret.settings.seo.robots.presets.${preset}`)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        )}
      />
      <Controller
        control={control}
        name="robots_txt"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="seo-robots" size="small" weight="plus">
              {t("qticaret.settings.seo.robots.label")}
            </Label>
            <Textarea id="seo-robots" rows={10} className="font-mono" {...field} />
            <Text
              size="xsmall"
              className={fieldState.error ? "text-ui-fg-error" : "text-ui-fg-subtle"}
            >
              {fieldState.error?.message
                ? t(fieldState.error.message)
                : t("qticaret.settings.seo.robots.hint")}
            </Text>
          </div>
        )}
      />
    </section>
  )
}

// The label is a key in the namespace our strings merge into (src/admin/i18n)
export const config = defineRouteConfig({
  label: "qticaret.settings.seo.title",
  translationNs: "translation",
})

export default SeoSettingsPage
