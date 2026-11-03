import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import type { MigrationMode, Parcel } from "@/features/settings/api/migration"
import {
  CATEGORY_BASE,
  MAX_WXR_BYTES,
  WXR_ACCEPT,
  isWxrName,
} from "@/features/settings/api/migration-wordpress"
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
const schema = z.object({
  file: z
    .custom<File | null>((value) => value === null || value instanceof File)
    .superRefine((value, ctx) => {
      const problem = fileProblem(value)
      if (problem) {
        ctx.addIssue({ code: "custom", message: problem })
      }
    }),
  categoryBase: z
    .string()
    .refine(
      (value) => value.trim().length <= 64 && CATEGORY_BASE.test(value.trim()),
      `${W}.errors.categoryBase`
    ),
  parcel: z
    .object({ weight: parcelText, length: parcelText, width: parcelText, height: parcelText })
    .refine((values) => readParcel(values) !== "invalid", `${W}.errors.parcel`),
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
 * carrying no measurements.
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
        onRun(mode, {
          file: values.file,
          categoryBase: values.categoryBase.trim(),
          parcel,
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
