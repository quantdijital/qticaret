import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { Counter } from "@/features/seo/components/seo-card"
import { useSaveSection } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { errorLine, optionalLineSchema } from "@/features/settings/storefront"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const H = "settings.seo.home"

// The server's limits (backend platform-settings/sections/seo.ts `home`)
const TITLE_MAX = 150
const DESCRIPTION_MAX = 320
// What search results show before cutting (docs/13 §3)
const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155

const schema = z.object({
  title: optionalLineSchema(TITLE_MAX),
  description: optionalLineSchema(DESCRIPTION_MAX),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: SeoSettings): Values => ({
  title: saved.home.title ?? "",
  description: saved.home.description ?? "",
})

/**
 * The storefront home page's title and meta description (F18, adr/0046).
 * Empty saves none: the title is then the shop's name and no description
 * is made up.
 */
export function HomeSeoCard({ saved, storeName }: { saved: SeoSettings; storeName: string }) {
  const { t } = useTranslation()
  const save = useSaveSection<SeoSettings>("seo")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const [title, description] = useWatch({ control: form.control, name: ["title", "description"] })
  const { errors } = form.formState
  const titleError = errorLine(t, errors.title, TITLE_MAX)
  const descriptionError = errorLine(t, errors.description, DESCRIPTION_MAX)
  const submit = form.handleSubmit((next) => {
    save.mutate(
      { home: { title: next.title || null, description: next.description || null } },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${H}.title`)}
      description={t(`${H}.hint`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <Field
        label={t(`${H}.pageTitle`)}
        htmlFor="seo-home-title"
        hint={t(`${H}.pageTitleHint`)}
        error={titleError}
      >
        <div className="flex flex-col gap-1">
          <Input
            id="seo-home-title"
            placeholder={storeName}
            aria-invalid={Boolean(titleError)}
            {...form.register("title")}
          />
          <div className="flex justify-end">
            {/* An empty title shows the shop's name, so that is what is counted */}
            <Counter length={(title.trim() || storeName).length} limit={TITLE_LIMIT} />
          </div>
        </div>
      </Field>
      <Field
        label={t(`${H}.description`)}
        htmlFor="seo-home-description"
        hint={t(`${H}.descriptionHint`)}
        error={descriptionError}
      >
        <div className="flex flex-col gap-1">
          <Textarea
            id="seo-home-description"
            className="min-h-20"
            aria-invalid={Boolean(descriptionError)}
            {...form.register("description")}
          />
          <div className="flex justify-end">
            <Counter length={description.trim().length} limit={DESCRIPTION_LIMIT} />
          </div>
        </div>
      </Field>
    </CardForm>
  )
}
