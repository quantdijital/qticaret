import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { useStoreName } from "@/features/settings/api/store"
import { HomeSeoCard } from "@/features/settings/components/home-seo-card"
import { SearchConsoleCard } from "@/features/settings/components/search-console-card"
import { ShareImageCard } from "@/features/settings/components/share-image-card"
import { TemplateField } from "@/features/settings/components/template-field"
import { UrlStyleCard } from "@/features/settings/components/url-style-card"
import { TEMPLATE_TOKENS } from "@/features/settings/seo-sample"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

// What search results show before cutting (docs/13 §3)
const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155
const ENTITIES = ["product", "category", "brand", "page", "post", "landing"] as const
const PRESETS = ["ai_search_visible", "block_training", "none"] as const

function useSave(form: Pick<UseFormReturn<SeoSettings>, "reset">) {
  const { t } = useTranslation()
  const save = useSaveSection<SeoSettings>("seo")
  const run = (values: Partial<SeoSettings>) => {
    save.mutate(values, {
      onSuccess: (saved) => {
        form.reset(saved.values, FULL_RESET)
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
        form.reset(saved, FULL_RESET)
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
        form.reset(saved, FULL_RESET)
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
        form.reset(saved, FULL_RESET)
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

/** The shop's saved SEO settings into `render`, or why they are not here yet. */
function Saved({ render }: { render: (values: SeoSettings) => ReactNode }) {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<SeoSettings>("seo"))
  return query.isError ? (
    <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  ) : !query.data ? (
    <LoadingRows rows={3} />
  ) : (
    render(query.data.values)
  )
}

/** Settings > SEO's addresses tab (docs/13): the shop's address and URL shape. */
export function SeoAddressesPart() {
  return (
    <Saved
      render={(values) => (
        <>
          <AddressCard saved={values} />
          <UrlStyleCard saved={values.url_style} />
        </>
      )}
    />
  )
}

/** Settings > SEO's titles tab: the home page's title, the templates and the share image. */
export function SeoPagesPart() {
  const { t } = useTranslation()
  const storeName = useStoreName() ?? t("app.name")
  return (
    <Saved
      render={(values) => (
        <>
          <HomeSeoCard saved={values} storeName={storeName} />
          <TemplatesCard saved={values} storeName={storeName} />
          <ShareImageCard saved={values} />
        </>
      )}
    />
  )
}

/** Settings > SEO's search engines tab: who may crawl the shop, and its Search Console. */
export function SeoSearchPart() {
  return (
    <>
      <Saved render={(values) => <CrawlersCard saved={values} />} />
      <SearchConsoleCard />
    </>
  )
}
