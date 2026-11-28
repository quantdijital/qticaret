import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { MigrationMode, Parcel } from "@/features/settings/api/migration"
import {
  CATEGORY_BASE,
  MAX_WXR_BYTES,
  WXR_ACCEPT,
  isWxrName,
} from "@/features/settings/api/migration-wordpress"
import type { WordpressRefresh } from "@/features/settings/api/migration-wordpress"
import { NO_PARCEL, readParcel } from "@/features/settings/components/migration/parcel"
import { ParcelFields, RunButtons } from "@/features/settings/components/migration/run-controls"

const W = "settings.migration.wordpress"

/** What is wrong with the chosen file, as an i18n key; nothing when it may be sent. */
function fileProblem(file: File | null): string | null {
  if (!file) {
    return `${W}.errors.fileRequired`
  }
  if (!isWxrName(file.name)) {
    return `${W}.errors.fileType`
  }
  return file.size > MAX_WXR_BYTES ? `${W}.errors.fileTooLarge` : null
}

const parcelText = z.string()
const schema = z
  .object({
    file: z
      .custom<File | null>((value) => value === null || value instanceof File)
      .superRefine((value, ctx) => {
        const problem = fileProblem(value)
        if (problem) {
          ctx.addIssue({ code: "custom", message: problem })
        }
      }),
    refresh: z.enum(["descriptions", "post_images"]).nullable(),
    categoryBase: z.string(),
    parcel: z.object({
      weight: parcelText,
      length: parcelText,
      width: parcelText,
      height: parcelText,
    }),
  })
  // A refresh writes descriptions or posts' pictures only: the address base and the parcel are not read
  .superRefine((values, ctx) => {
    if (values.refresh) {
      return
    }
    const base = values.categoryBase.trim()
    if (base.length > 64 || !CATEGORY_BASE.test(base)) {
      ctx.addIssue({ code: "custom", path: ["categoryBase"], message: `${W}.errors.categoryBase` })
    }
    if (readParcel(values.parcel) === "invalid") {
      ctx.addIssue({ code: "custom", path: ["parcel"], message: `${W}.errors.parcel` })
    }
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = { file: null, refresh: null, categoryBase: "", parcel: NO_PARCEL }

// The refresh-only runs, each its own box; ticking one clears the other
const REFRESHES: readonly { kind: WordpressRefresh; label: string; hint: string }[] = [
  { kind: "descriptions", label: "refresh", hint: "refreshHint" },
  { kind: "post_images", label: "postImages", hint: "postImagesHint" },
]

export interface WordpressRun {
  file: File
  categoryBase: string
  parcel: Parcel | null
  /**
   * Only this of what an earlier run moved: the products' descriptions
   * rewritten (ADR-0055), or the blog posts' pictures added (adr/0042 Ek 2026-11-27).
   */
  refresh: WordpressRefresh | null
}

interface WordpressSourceProps {
  disabled: boolean
  pending: MigrationMode | null
  onRun: (mode: MigrationMode, run: WordpressRun) => void
}

/**
 * The WordPress source's form (adr/0042 Ek 2026-11-03): the site's export
 * (XML or a zip holding it, 50 MB), checked as it is chosen; the product
 * categories' old address base, read from the site's own links when left
 * empty; and the parcel, which most WooCommerce shops need, their products
 * carrying no measurements. "Refresh descriptions only" (ADR-0055) rewrites
 * the descriptions of products already moved and nothing else: applied
 * only, without the base or the parcel. "Move blog pictures only" adds the
 * pictures an earlier run left out to the posts it moved; it may be tried
 * dry first.
 */
export function WordpressSource({ disabled, pending, onRun }: WordpressSourceProps) {
  const { t } = useTranslation()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const file = useWatch({ control: form.control, name: "file" })
  const refresh = useWatch({ control: form.control, name: "refresh" })
  const { errors } = form.formState
  const errorOf = (message: string | undefined) => (message ? t(message) : undefined)
  const run = (mode: MigrationMode) =>
    void form.handleSubmit((values) => {
      const parcel = values.refresh ? null : readParcel(values.parcel)
      if (values.file && parcel !== "invalid") {
        onRun(mode, {
          file: values.file,
          categoryBase: values.refresh ? "" : values.categoryBase.trim(),
          parcel,
          refresh: values.refresh,
        })
      }
    })()
  return (
    <>
      <Field
        label={t(`${W}.file`)}
        htmlFor="wordpress-file"
        hint={t(`${W}.fileHint`)}
        error={errorOf(errors.file?.message)}
      >
        <Controller
          control={form.control}
          name="file"
          render={({ field }) => (
            <Input
              id="wordpress-file"
              type="file"
              accept={WXR_ACCEPT}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              onChange={(event) => {
                field.onChange(event.target.files?.[0] ?? null)
                // A file too large or of the wrong kind is said at once, not at the run
                void form.trigger("file")
              }}
            />
          )}
        />
      </Field>
      <Controller
        control={form.control}
        name="refresh"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            {REFRESHES.map(({ kind, label, hint }) => {
              const id = `wordpress-refresh-${kind}`
              return (
                <div key={kind} className="flex items-start gap-3 rounded-md border px-3 py-2.5">
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={field.value === kind}
                    aria-describedby={`${id}-hint`}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true ? kind : null)
                    }}
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <label htmlFor={id} className="cursor-pointer text-sm font-medium">
                      {t(`${W}.${label}`)}
                    </label>
                    <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
                      {t(`${W}.${hint}`)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      />
      {/* What a full run reads; a refresh leaves them as they are */}
      <fieldset disabled={refresh !== null} className="flex flex-col gap-4 disabled:opacity-60">
        <Field
          label={t(`${W}.categoryBase`)}
          htmlFor="wordpress-category-base"
          hint={t(`${W}.categoryBaseHint`)}
          error={errorOf(errors.categoryBase?.message)}
        >
          <Input
            id="wordpress-category-base"
            placeholder="/urun-kategori/"
            autoComplete="off"
            spellCheck={false}
            {...form.register("categoryBase")}
          />
        </Field>
        <ParcelFields
          inputProps={(field) => form.register(`parcel.${field}`)}
          note={t(`${W}.parcelNote`)}
          error={errorOf(errors.parcel?.message)}
        />
      </fieldset>
      <RunButtons
        disabled={disabled || file === null}
        checkDisabled={refresh === "descriptions"}
        pending={pending}
        onCheck={() => {
          run("check")
        }}
        onApply={() => {
          run("apply")
        }}
      />
    </>
  )
}
