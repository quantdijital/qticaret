import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { MigrationMode, Parcel } from "@/features/settings/api/migration"
import { CATEGORY_BASE, WXR_ACCEPT } from "@/features/settings/api/migration-wordpress"
import { fileProblem } from "@/features/settings/components/migration/wxr-file"
import { NO_PARCEL, readParcel } from "@/features/settings/components/migration/parcel"
import {
  AdvancedOptions,
  ParcelFields,
  RunButtons,
} from "@/features/settings/components/migration/run-controls"

const W = "settings.migration.wordpress"

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
    categoryBase: z.string(),
    parcel: z.object({
      weight: parcelText,
      length: parcelText,
      width: parcelText,
      height: parcelText,
    }),
  })
  .superRefine((values, ctx) => {
    const base = values.categoryBase.trim()
    if (base.length > 64 || !CATEGORY_BASE.test(base)) {
      ctx.addIssue({ code: "custom", path: ["categoryBase"], message: `${W}.errors.categoryBase` })
    }
    if (readParcel(values.parcel) === "invalid") {
      ctx.addIssue({ code: "custom", path: ["parcel"], message: `${W}.errors.parcel` })
    }
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = { file: null, categoryBase: "", parcel: NO_PARCEL }

export interface WordpressRun {
  file: File
  categoryBase: string
  parcel: Parcel | null
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
 * carrying no measurements. The two are folded under "Gelişmiş": most
 * shops leave them empty. Rewriting the descriptions of products already
 * moved (ADR-0055) is its own card, `DescriptionRefreshCard`.
 */
export function WordpressSource({ disabled, pending, onRun }: WordpressSourceProps) {
  const { t } = useTranslation()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const file = useWatch({ control: form.control, name: "file" })
  const { errors } = form.formState
  const errorOf = (message: string | undefined) => (message ? t(message) : undefined)
  const run = (mode: MigrationMode) =>
    void form.handleSubmit((values) => {
      const parcel = readParcel(values.parcel)
      if (values.file && parcel !== "invalid") {
        onRun(mode, { file: values.file, categoryBase: values.categoryBase.trim(), parcel })
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
      <AdvancedOptions attention={Boolean(errors.categoryBase ?? errors.parcel)}>
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
      </AdvancedOptions>
      <RunButtons
        disabled={disabled || file === null}
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
