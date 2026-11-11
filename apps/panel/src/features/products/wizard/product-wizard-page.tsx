import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight, Loader2, Send } from "lucide-react"
import { useState } from "react"
import type { ComponentType } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Wizard } from "@qticaret/admin-ui/patterns/wizard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { LimitNotice } from "@/features/settings/components/limit-notice"
import { usePlanFailureToast } from "@/features/settings/use-plan-failure"
import { errorText } from "@/lib/errors"
import { useCreateProduct } from "./create-product"
import { canPublish, readiness } from "./readiness"
import { STEP_FIELDS, defaultWizardValues, stepsFor, wizardSchema } from "./schema"
import type { WizardStepKey, WizardValues } from "./schema"
import { BasicsStep } from "./steps/basics-step"
import { MediaStep } from "./steps/media-step"
import { PricingStep } from "./steps/pricing-step"
import { ReviewStep } from "./steps/review-step"
import { ShippingStep } from "./steps/shipping-step"

const STEP_VIEWS: Record<WizardStepKey, ComponentType> = {
  basics: BasicsStep,
  media: MediaStep,
  pricing: PricingStep,
  shipping: ShippingStep,
  review: ReviewStep,
}

/** The first step holding an error, so a failed save shows where to look. */
const firstStepWithError = (keys: WizardStepKey[], errors: FieldErrors<WizardValues>): number =>
  keys.findIndex((key) =>
    (STEP_FIELDS[key] as readonly (keyof WizardValues)[]).some((field) => errors[field])
  )

/** Adding a product in five steps (docs/06 §4): one question group at a time. */
export function ProductWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: defaultWizardValues(),
    mode: "onTouched",
  })
  const [current, setCurrent] = useState(0)
  const [reached, setReached] = useState(0)
  const defaults = useQuery(shopDefaultsQuery())
  const create = useCreateProduct()
  // A product past the package's limit is refused: the toast links to Settings > Abonelik
  const planFailure = usePlanFailureToast()
  const values = useWatch({ control: form.control }) as WizardValues
  const stepKeys = stepsFor(values.kind)
  const stepKey = stepKeys[current] ?? "basics"
  const last = current === stepKeys.length - 1
  const publishable = canPublish(readiness(values))
  const StepView = STEP_VIEWS[stepKey]

  const goTo = (index: number) => {
    setCurrent(index)
    setReached((was) => Math.max(was, index))
    window.scrollTo({ top: 0 })
  }
  const next = async () => {
    if (await form.trigger([...STEP_FIELDS[stepKey]])) {
      goTo(current + 1)
    }
  }
  const save = (publish: boolean) =>
    form.handleSubmit(
      (submitted) => {
        if (!defaults.data) {
          // The shop's defaults could not be read: say so instead of doing nothing
          toast.error(t("products.wizard.defaultsFailed"))
          void defaults.refetch()
          return
        }
        create.mutate(
          {
            values: submitted,
            publish,
            defaults: defaults.data,
            defaultOption: {
              title: t("products.wizard.defaultOption"),
              value: t("products.wizard.defaultValue"),
            },
          },
          {
            onSuccess: ({ productId, stockProblem }) => {
              toast.success(t(publish ? "products.wizard.published" : "products.wizard.drafted"))
              if (stockProblem?.kind === "no_location") {
                toast.warning(t("products.wizard.stockNoLocation"))
              } else if (stockProblem) {
                toast.warning(
                  `${t("products.wizard.stockFailed")} ${errorText(t, stockProblem.reason)}`
                )
              }
              // Saved: leaving is no longer a loss, so the guard stands aside
              void navigate({ to: "/products/$id", params: { id: productId }, ignoreBlocker: true })
            },
            onError: planFailure,
          }
        )
      },
      (errors) => {
        const index = firstStepWithError(stepKeys, errors)
        if (index >= 0) {
          goTo(index)
        }
      }
    )()

  const steps = stepKeys.map((key) => ({
    key,
    title: t(`products.wizard.steps.${key}.title`),
    description: t(`products.wizard.steps.${key}.description`),
  }))
  const busy = create.isPending || defaults.isPending

  return (
    <div className="flex flex-col gap-6">
      <LeaveGuard when={form.formState.isDirty && !create.isSuccess} />
      <PageHeader
        title={t("products.wizard.pageTitle")}
        back={{ to: "/products", label: t("nav.products") }}
      />
      <LimitNotice limit="products" />
      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={(event) => {
            // Enter moves on; saving is always an explicit button
            event.preventDefault()
            if (!last) {
              void next()
            }
          }}
        >
          <Wizard
            steps={steps}
            current={current}
            reached={reached}
            onStepSelect={goTo}
            footer={
              <>
                {current === 0 ? (
                  <Button variant="ghost" asChild>
                    <Link to="/products">{t("common.cancel")}</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      goTo(current - 1)
                    }}
                  >
                    <ArrowLeft />
                    {t("common.back")}
                  </Button>
                )}
                {last ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {publishable ? null : (
                      <span className="hidden text-xs text-muted-foreground md:inline">
                        {t("products.wizard.publishBlocked")}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void save(false)}
                    >
                      {t("products.wizard.saveDraft")}
                    </Button>
                    <Button
                      type="button"
                      disabled={busy || !publishable}
                      onClick={() => void save(true)}
                    >
                      {create.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                      {t("products.wizard.publish")}
                    </Button>
                  </div>
                ) : (
                  <Button type="submit">
                    {t("common.next")}
                    <ArrowRight />
                  </Button>
                )}
              </>
            }
          >
            <StepView />
          </Wizard>
        </form>
      </FormProvider>
    </div>
  )
}
