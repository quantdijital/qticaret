import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { Controller, FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useCreatePopup, useUpdatePopup } from "@/features/popups/api/popups"
import type { PopupDetail, PopupType } from "@/features/popups/api/types"
import { emptyValues, popupSchema, refusalField, requestOf, valuesOf } from "@/features/popups/form"
import type { PopupValues } from "@/features/popups/form"
import { errorText } from "@/lib/errors"
import { AudienceCard } from "./audience-card"
import { ContentCard } from "./content-card"
import { LookCard } from "./look-card"
import { PreviewCard } from "./preview-card"
import { TimingCard } from "./timing-card"

const F = "popups.form"

/** Saves a new pop-up, or a saved one's changes; one form for both. */
function useSave(existing: PopupDetail | null) {
  const create = useCreatePopup()
  const update = useUpdatePopup(existing?.id ?? "")
  return existing ? update : create
}

/**
 * The pop-up's one page (adr/0080 S2): its content, who and where, when,
 * and how it looks on the left; the live preview, the save and `aside`
 * (a saved one's facts and counts) in the sticky right column from 1280
 * px (under the form on a narrower screen). Read-only for a role that may
 * not write (the API refuses it anyway).
 */
export function PopupForm({
  existing,
  type,
  canWrite,
  aside,
}: {
  existing: PopupDetail | null
  /** A new one's type, chosen first. */
  type?: PopupType
  canWrite: boolean
  /** Short facts under the save in the right column. */
  aside?: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSave(existing)
  const form = useForm<PopupValues>({
    resolver: zodResolver(popupSchema),
    defaultValues: existing ? valuesOf(existing) : emptyValues(type ?? "info"),
  })
  const submit = form.handleSubmit(
    (values) => {
      save.mutate(requestOf(values, { create: existing === null }), {
        onSuccess: (saved) => {
          form.reset(valuesOf(saved), FULL_RESET)
          toast.success(t(existing ? `${F}.saved` : `${F}.created`))
          if (!existing) {
            void navigate({ to: "/popups/$id", params: { id: saved.id }, ignoreBlocker: true })
          }
        },
        onError: (failure) => {
          const field = refusalField(failure)
          if (field) {
            form.setError(field, { message: errorText(t, failure) }, { shouldFocus: true })
          }
          toast.error(errorText(t, failure))
        },
      })
    },
    () => {
      toast.error(t(`${F}.invalid`))
    }
  )
  return (
    <FormProvider {...form}>
      <LeaveGuard when={form.formState.isDirty && !save.isPending} />
      <form
        noValidate
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        <PageGrid>
          {/* `contents`: the fieldset only locks the fields; the grid's columns stay its own */}
          <fieldset disabled={!canWrite} className="contents">
            <PageColumn span={8}>
              <ContentCard isNew={existing === null} />
              <AudienceCard />
              <TimingCard />
              <LookCard />
            </PageColumn>
          </fieldset>
          <PageColumn span={4} sticky>
            <PreviewCard />
            {existing || !canWrite ? null : (
              <label
                htmlFor="popup-activate"
                className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 shadow-card"
              >
                <span className="text-sm font-medium">{t(`${F}.activate`)}</span>
                <Controller
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <Switch
                      id="popup-activate"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </label>
            )}
            {canWrite ? (
              <Button
                type="submit"
                disabled={save.isPending || (existing !== null && !form.formState.isDirty)}
              >
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(existing ? "common.save" : `${F}.create`)}
              </Button>
            ) : null}
            {aside}
          </PageColumn>
        </PageGrid>
      </form>
    </FormProvider>
  )
}
