import { TriangleAlert } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useUpdateLanding } from "@/features/content/api/landings"
import type { LandingDetail } from "@/features/content/api/landings"
import { errorText } from "@/lib/errors"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"

interface Values {
  title: string
  handle: string
}

const valuesOf = (landing: LandingDetail): Values => ({
  title: landing.title,
  handle: landing.handle,
})

// The category's path the page sits under (`/kategori/bicak/`), from the page's own
const prefixOf = (landing: LandingDetail) =>
  landing.path ? landing.path.slice(0, landing.path.lastIndexOf("/") + 1) : "…/"

// The category or the facet the page was made for is gone: it lists nothing, or has no address
function Orphaned({ landing }: { landing: LandingDetail }) {
  const { t } = useTranslation()
  const gone = landing.category ? (landing.facet.label === null ? "facet" : null) : "category"
  if (!gone) {
    return null
  }
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] font-medium text-warning-text">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {t(`content.landing.gone.${gone}`)}
    </p>
  )
}

/** The title and the address under its category; the facet stays as the page was made. */
export function LandingGeneralCard({ landing }: { landing: LandingDetail }) {
  const { t } = useTranslation()
  const update = useUpdateLanding(landing.id)
  const saved = valuesOf(landing)
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const submit = form.handleSubmit((values) => {
    const settle = beginSave(form)
    const { dirtyFields } = form.formState
    update.mutate(
      {
        ...(dirtyFields.title ? { title: values.title } : {}),
        ...(dirtyFields.handle ? { handle: values.handle.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          settle(valuesOf(result.landing))
          toast.success(t("content.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t("content.general")}
      description={t("content.landing.facetIs", {
        facet: landing.facet.label ?? landing.facet.value,
      })}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Orphaned landing={landing} />
      <Field label={t("content.fields.title")} htmlFor="landing-title-edit" required>
        <Input
          placeholder={t("content.placeholders.landingTitle")}
          id="landing-title-edit"
          maxLength={200}
          {...form.register("title")}
        />
      </Field>
      <Field
        label={t("content.fields.handle")}
        htmlFor="landing-handle"
        hint={t("content.handleHint")}
      >
        <div className="flex items-center rounded-md border">
          <span className="max-w-[60%] shrink-0 truncate pl-3 font-mono text-[13px] text-muted-foreground">
            {prefixOf(landing)}
          </span>
          <Input
            placeholder={t("content.placeholders.landingHandle")}
            id="landing-handle"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 pl-0 font-mono text-[13px] shadow-none"
            {...form.register("handle")}
          />
        </div>
      </Field>
    </CardForm>
  )
}
