import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Globe, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useAiFill } from "@/features/seo/advisor/ai-fill"
import { parseFocusKeywords } from "@/features/seo/focus-keywords"
import { ROBOTS_OVERRIDES, seoMetaQuery, useSaveSeoMeta } from "@/features/seo/api/seo-meta"
import type { SeoEntityType, SeoMeta } from "@/features/seo/api/seo-meta"
import { sectionQuery } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { renderSample } from "@/features/settings/seo-sample"
import { useStoreName } from "@/features/settings/api/store"
import { errorText } from "@/lib/errors"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { DESCRIPTION_LIMIT, SEO_MAX, TITLE_LIMIT } from "./seo-limits"
import { seoSummary } from "./seo-summary"
import type { SeoCollapse } from "./seo-summary"
import { FocusKeywordField } from "./focus-keyword-field"
import { SeoTextFields } from "./seo-text-fields"

// Other cards measure their texts the same way
export { Counter } from "./seo-text-fields"

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

function SeoForm({
  type,
  id,
  saved,
  context,
  collapse,
}: {
  type: SeoEntityType
  id: string
  saved: SeoMeta
  context: SeoContext
  collapse?: SeoCollapse | undefined
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
  const [title, description, keywords] = useWatch({
    control: form.control,
    name: ["seo_title", "seo_description", "focus_keyword"],
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

  // An accepted suggestion is the person's change: the preview and the counters follow, Save writes it
  const use = (name: "seo_title" | "seo_description", text: string) => {
    form.setValue(name, text, { shouldDirty: true })
  }
  // The same from the advisor's "Yapay zekâyla düzelt" on a finding (docs/22 "Aşama 3")
  useAiFill(type, id, "seo_title", (text) => {
    use("seo_title", text.slice(0, SEO_MAX.title))
  })
  useAiFill(type, id, "seo_description", (text) => {
    use("seo_description", text.slice(0, SEO_MAX.description))
  })

  const submit = form.handleSubmit((next) => {
    const settle = beginSave(form)
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
        settle(next)
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
      collapse={
        collapse && {
          id: collapse.id,
          name: collapse.name,
          attention: Boolean(collapse.attention),
          summary: seoSummary(t, {
            title: { own: title, shown: shownTitle, limit: TITLE_LIMIT },
            description: { own: description, shown: shownDescription, limit: DESCRIPTION_LIMIT },
            keywords: parseFocusKeywords(keywords),
            note: collapse.note,
          }),
        }
      }
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
      <SeoTextFields
        type={type}
        id={id}
        title={form.register("seo_title")}
        description={form.register("seo_description")}
        titlePlaceholder={renderSample(titleTemplate, storeName, context.tokens)}
        shown={{ title: shownTitle, description: shownDescription }}
        onUse={use}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="focus_keyword"
          render={({ field }) => (
            <FocusKeywordField type={type} id={id} value={field.value} onChange={field.onChange} />
          )}
        />
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
  collapse,
}: {
  type: SeoEntityType
  id: string
  context: SeoContext
  /** Folds to a line with the fields' lengths (content pages). */
  collapse?: SeoCollapse
}) {
  const query = useQuery(seoMetaQuery(type, id))
  if (!query.data) {
    return <Skeleton className={collapse ? "h-14 rounded-lg" : "h-64 rounded-lg"} />
  }
  return <SeoForm type={type} id={id} saved={query.data} context={context} collapse={collapse} />
}
