import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Globe, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ROBOTS_OVERRIDES, seoMetaQuery, useSaveSeoMeta } from "@/features/seo/api/seo-meta"
import type { SeoEntityType, SeoMeta } from "@/features/seo/api/seo-meta"
import { sectionQuery } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { renderSample } from "@/features/settings/seo-sample"
import { useStoreName } from "@/features/settings/api/store"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { cn } from "@/lib/utils"

// What search results show before cutting (docs/13 §3)
const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155
const DEFAULT_ROBOTS = "__default__"

interface Values {
  seo_title: string
  seo_description: string
  focus_keyword: string
  canonical_override: string
  robots_override: string
}

export interface SeoContext {
  /** The page's path on the storefront, for the preview. */
  path: string
  /** Template token values for this page (ürün_adı, kategori…); the shop's name is added. */
  tokens: Record<string, string>
  /** The description to show when there is no override nor template (a category's text). */
  fallbackDescription: string
}

/** A length against what search results show; past it, in the warning colour. */
export function Counter({ length, limit }: { length: number; limit: number }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        length > limit ? "text-warning-text" : "text-muted-foreground"
      )}
    >
      {length}/{limit}
    </span>
  )
}

function SeoForm({
  type,
  id,
  saved,
  context,
}: {
  type: SeoEntityType
  id: string
  saved: SeoMeta
  context: SeoContext
}) {
  const { t } = useTranslation()
  const save = useSaveSeoMeta(type, id)
  const { data: settings } = useQuery(sectionQuery<SeoSettings>("seo"))
  const storeName = useStoreName() ?? ""
  const [advanced, setAdvanced] = useState(Boolean(saved.canonical_override))
  const [duplicates, setDuplicates] = useState({ seo_title: 0, seo_description: 0 })
  const values: Values = {
    seo_title: saved.seo_title ?? "",
    seo_description: saved.seo_description ?? "",
    focus_keyword: saved.focus_keyword ?? "",
    canonical_override: saved.canonical_override ?? "",
    robots_override: saved.robots_override ?? DEFAULT_ROBOTS,
  }
  const form = useForm<Values>({ values, resetOptions: { keepDirtyValues: true } })
  const [title, description] = useWatch({
    control: form.control,
    name: ["seo_title", "seo_description"],
  })

  // The template fills what is left empty, as the storefront will (F3.4b); a blog archive is titled as a post
  const templateKey =
    type === "collection"
      ? "category"
      : type === "post_category" || type === "post_tag"
        ? "post"
        : type
  const titleTemplate = settings?.values.title_templates[templateKey] ?? ""
  const shownTitle = title.trim() || renderSample(titleTemplate, storeName, context.tokens)
  const shownDescription =
    description.trim() ||
    (type === "product" && settings?.values.description_templates.product
      ? renderSample(settings.values.description_templates.product, storeName, context.tokens)
      : context.fallbackDescription)
  const host = settings?.values.canonical_host ?? t("seo.sampleHost")

  const submit = form.handleSubmit((next) => {
    const { dirtyFields } = form.formState
    const body: Partial<SeoMeta> = {
      ...(dirtyFields.seo_title ? { seo_title: next.seo_title.trim() || null } : {}),
      ...(dirtyFields.seo_description
        ? { seo_description: next.seo_description.trim() || null }
        : {}),
      ...(dirtyFields.focus_keyword ? { focus_keyword: next.focus_keyword.trim() || null } : {}),
      ...(dirtyFields.canonical_override
        ? { canonical_override: next.canonical_override.trim() || null }
        : {}),
      ...(dirtyFields.robots_override
        ? {
            robots_override:
              next.robots_override === DEFAULT_ROBOTS
                ? null
                : (next.robots_override as SeoMeta["robots_override"]),
          }
        : {}),
    }
    save.mutate(body, {
      onSuccess: (result) => {
        form.reset(next, FULL_RESET)
        setDuplicates(result.duplicates)
        toast.success(t("seo.card.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })

  return (
    <CardForm
      title={t("seo.card.title")}
      description={t("seo.card.hint")}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="flex flex-col gap-1 rounded-lg border bg-background p-4">
        <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
          <Globe className="size-3.5 shrink-0" aria-hidden="true" />
          {host}
          {context.path}
        </span>
        <span className="truncate text-lg text-info-text">{shownTitle || "—"}</span>
        <span className="line-clamp-2 text-sm text-muted-foreground">
          {shownDescription || t("seo.card.noDescription")}
        </span>
      </div>
      {duplicates.seo_title > 0 || duplicates.seo_description > 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("seo.card.duplicates", {
            title: duplicates.seo_title,
            description: duplicates.seo_description,
          })}
        </p>
      ) : null}
      <Field
        label={t("seo.card.seoTitle")}
        htmlFor={`seo-title-${id}`}
        hint={t("seo.card.seoTitleHint")}
      >
        <div className="flex flex-col gap-1">
          <Input
            id={`seo-title-${id}`}
            placeholder={renderSample(titleTemplate, storeName, context.tokens)}
            {...form.register("seo_title")}
          />
          <div className="flex justify-end">
            <Counter length={shownTitle.length} limit={TITLE_LIMIT} />
          </div>
        </div>
      </Field>
      <Field
        label={t("seo.card.seoDescription")}
        htmlFor={`seo-description-${id}`}
        hint={t("seo.card.seoDescriptionHint")}
      >
        <div className="flex flex-col gap-1">
          <Textarea
            id={`seo-description-${id}`}
            className="min-h-20"
            {...form.register("seo_description")}
          />
          <div className="flex justify-end">
            <Counter length={shownDescription.length} limit={DESCRIPTION_LIMIT} />
          </div>
        </div>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("seo.card.focusKeyword")}
          htmlFor={`seo-keyword-${id}`}
          hint={t("seo.card.focusKeywordHint")}
        >
          <Input id={`seo-keyword-${id}`} {...form.register("focus_keyword")} />
        </Field>
        <Field label={t("seo.card.robots")} htmlFor={`seo-robots-${id}`}>
          <Controller
            control={form.control}
            name="robots_override"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`seo-robots-${id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_ROBOTS}>{t("seo.card.robotsDefault")}</SelectItem>
                  {ROBOTS_OVERRIDES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`seo.card.robotsOptions.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
      <button
        type="button"
        onClick={() => {
          setAdvanced((was) => !was)
        }}
        className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          className={cn("size-3.5 transition-transform", advanced && "rotate-180")}
          aria-hidden="true"
        />
        {t("seo.card.advanced")}
      </button>
      {advanced ? (
        <Field
          label={t("seo.card.canonical")}
          htmlFor={`seo-canonical-${id}`}
          hint={t("seo.card.canonicalHint")}
        >
          <Input
            id={`seo-canonical-${id}`}
            spellCheck={false}
            placeholder={context.path}
            className="font-mono text-[13px]"
            {...form.register("canonical_override")}
          />
        </Field>
      ) : null}
    </CardForm>
  )
}

/** A page's own SEO fields (adr/0015) with a search-result preview; empty fields use the templates. */
export function SeoCard({
  type,
  id,
  context,
}: {
  type: SeoEntityType
  id: string
  context: SeoContext
}) {
  const query = useQuery(seoMetaQuery(type, id))
  if (!query.data) {
    return <Skeleton className="h-64 rounded-lg" />
  }
  return <SeoForm type={type} id={id} saved={query.data} context={context} />
}
