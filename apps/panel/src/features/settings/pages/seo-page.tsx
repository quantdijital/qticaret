import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { useStoreName } from "@/features/settings/api/store"
import { SearchConsoleCard } from "@/features/settings/components/search-console-card"
import { ShareImageCard } from "@/features/settings/components/share-image-card"
import { TemplateField } from "@/features/settings/components/template-field"
import { UrlStyleCard } from "@/features/settings/components/url-style-card"
import { TEMPLATE_TOKENS } from "@/features/settings/seo-sample"
import { errorText } from "@/lib/errors"

// What search results show before cutting (docs/13 §3)
const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155
const ENTITIES = ["product", "category", "brand", "page", "post", "landing"] as const
const PRESETS = ["ai_search_visible", "block_training", "none"] as const

function useSave(form: { reset: (values: SeoSettings) => void }) {
  const { t } = useTranslation()
  const save = useSaveSection<SeoSettings>("seo")
  const run = (values: Partial<SeoSettings>) => {
    save.mutate(values, {
      onSuccess: (saved) => {
        form.reset(saved.values)
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return { run, saving: save.isPending }
}

function AddressCard({ saved }: { saved: SeoSettings }) {
  const { t } = useTranslation()
  const form = useForm<SeoSettings>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const { run, saving } = useSave(form)
  const submit = form.handleSubmit((values) => {
    const host = values.canonical_host?.trim()
    run({ canonical_host: host?.length ? host : null })
  })
  return (
    <CardForm
      title={t("settings.seo.addresses")}
      description={t("settings.seo.addressesHint")}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
      }}
    >
      <Field label={t("settings.seo.host")} htmlFor="seo-host" hint={t("settings.seo.hostHint")}>
        <Input
          id="seo-host"
          placeholder="www.magazaniz.com"
          spellCheck={false}
          {...form.register("canonical_host")}
        />
      </Field>
    </CardForm>
  )
}

function TemplatesCard({ saved, storeName }: { saved: SeoSettings; storeName: string }) {
  const { t } = useTranslation()
  const form = useForm<SeoSettings>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const { run, saving } = useSave(form)
  const submit = form.handleSubmit((values) => {
    run({
      title_templates: values.title_templates,
      description_templates: values.description_templates,
    })
  })
  return (
    <CardForm
      title={t("settings.seo.templates")}
      description={t("settings.seo.templatesHint")}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
      }}
    >
      {ENTITIES.map((entity) => (
        <Controller
          key={entity}
          control={form.control}
          name={`title_templates.${entity}`}
          render={({ field }) => (
            <TemplateField
              id={`seo-title-${entity}`}
              label={t(`settings.seo.titleTemplate.${entity}`)}
              value={field.value}
              onChange={field.onChange}
              tokens={TEMPLATE_TOKENS[entity]}
              limit={TITLE_LIMIT}
              storeName={storeName}
            />
          )}
        />
      ))}
      <Controller
        control={form.control}
        name="description_templates.product"
        render={({ field }) => (
          <TemplateField
            id="seo-description-product"
            label={t("settings.seo.descriptionTemplate")}
            value={field.value}
            onChange={field.onChange}
            tokens={TEMPLATE_TOKENS.product}
            limit={DESCRIPTION_LIMIT}
            storeName={storeName}
          />
        )}
      />
    </CardForm>
  )
}

function CrawlersCard({ saved }: { saved: SeoSettings }) {
  const { t } = useTranslation()
  const form = useForm<SeoSettings>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const { run, saving } = useSave(form)
  const submit = form.handleSubmit((values) => {
    run({ robots_txt: values.robots_txt, ai_crawler_preset: values.ai_crawler_preset })
  })
  return (
    <CardForm
      title={t("settings.seo.crawlers")}
      description={t("settings.seo.crawlersHint")}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
      }}
    >
      <Field label={t("settings.seo.ai")}>
        <Controller
          control={form.control}
          name="ai_crawler_preset"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex flex-col gap-2"
            >
              {PRESETS.map((preset) => (
                <label
                  key={preset}
                  className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem value={preset} className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t(`settings.seo.presets.${preset}.title`)}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {t(`settings.seo.presets.${preset}.description`)}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </Field>
      <Field label="robots.txt" htmlFor="seo-robots" hint={t("settings.seo.robotsHint")}>
        <Textarea
          id="seo-robots"
          spellCheck={false}
          className="min-h-56 font-mono text-[13px]"
          {...form.register("robots_txt")}
        />
      </Field>
    </CardForm>
  )
}

/**
 * Settings > SEO (docs/13): the shop's address and share image, URL shape,
 * templates and who may crawl it.
 */
export function SeoPage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<SeoSettings>("seo"))
  const storeName = useStoreName() ?? t("app.name")
  const saved = (render: (values: SeoSettings) => ReactNode) =>
    query.isError ? (
      <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
    ) : !query.data ? (
      <LoadingRows rows={3} />
    ) : (
      render(query.data.values)
    )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("settings.seo.title")} description={t("settings.seo.subtitle")} />
      {/* In tabs (the owner, 2026-10-31): the shop's addresses, how pages read, what search sees */}
      <SettingsTabs
        label={t("settings.seo.title")}
        tabs={[
          {
            key: "addresses",
            label: t("settings.seo.tabs.addresses"),
            content: saved((values) => (
              <>
                <AddressCard saved={values} />
                <UrlStyleCard saved={values.url_style} />
              </>
            )),
          },
          {
            key: "pages",
            label: t("settings.seo.tabs.pages"),
            content: saved((values) => (
              <>
                <TemplatesCard saved={values} storeName={storeName} />
                <ShareImageCard saved={values} />
              </>
            )),
          },
          {
            key: "search",
            label: t("settings.seo.tabs.search"),
            content: (
              <>
                {saved((values) => (
                  <CrawlersCard saved={values} />
                ))}
                <SearchConsoleCard />
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
