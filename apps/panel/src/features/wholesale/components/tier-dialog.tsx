import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { tierBodyOf, tierSchema, tierValuesOf } from "@/features/wholesale/account-form"
import type { TierValues } from "@/features/wholesale/account-form"
import { useCreateTier, useUpdateTier } from "@/features/wholesale/api/tiers"
import type { WholesaleTier } from "@/features/wholesale/api/types"
import { errorText } from "@/lib/errors"

const T = "wholesale.tiers.form"

/**
 * A wholesale level (ADR-0068 §1): its name, a rate off every variant's
 * own price (written by a background job, the rows a page each) and the
 * fewest units an order holds. New, it opens its page.
 */
export function TierDialog({
  tier,
  open,
  onOpenChange,
}: {
  /** Null: a new level. */
  tier: WholesaleTier | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateTier()
  const update = useUpdateTier(tier?.id ?? "")
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<TierValues>({
    resolver: zodResolver(tierSchema),
    values: tierValuesOf(tier),
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isDirty, isSubmitting, dirtyFields } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    const body = tierBodyOf(values)
    try {
      if (!tier) {
        const { tier: made } = await create.mutateAsync(body)
        toast.success(t(`${T}.created`))
        onOpenChange(false)
        void navigate({ to: "/wholesale/tiers/$id", params: { id: made.id } })
        return
      }
      await update.mutateAsync({
        ...(dirtyFields.name ? { name: body.name } : {}),
        ...(dirtyFields.percent ? { percent: body.percent } : {}),
        ...(dirtyFields.min_quantity ? { min_quantity: body.min_quantity } : {}),
      })
      toast.success(t(`${T}.saved`))
      onOpenChange(false)
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset()
          setFailure(null)
        }
        onOpenChange(next)
      }}
      title={t(tier ? `${T}.editTitle` : `${T}.newTitle`)}
      description={t(`${T}.text`)}
      dirty={isDirty}
      saving={isSubmitting}
      onSubmit={() => {
        void submit()
      }}
      submitLabel={tier ? t("common.save") : t(`${T}.create`)}
    >
      <DialogBody>
        <Field
          label={t(`${T}.name`)}
          htmlFor="tier-name"
          hint={t(`${T}.nameHint`)}
          error={message(errors.name?.message)}
          required
        >
          <Input id="tier-name" autoComplete="off" maxLength={100} {...form.register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t(`${T}.percent`)}
            htmlFor="tier-percent"
            hint={t(`${T}.percentHint`)}
            error={message(errors.percent?.message)}
          >
            <NumberField
              id="tier-percent"
              decimals={2}
              min={0}
              max={99}
              suffix="%"
              {...form.register("percent")}
            />
          </Field>
          <Field
            label={t("wholesale.form.minimum")}
            htmlFor="tier-minimum"
            hint={t("wholesale.form.minimumHint")}
            error={message(errors.min_quantity?.message)}
          >
            <NumberField
              id="tier-minimum"
              min={1}
              suffix={t("wholesale.form.units")}
              {...form.register("min_quantity")}
            />
          </Field>
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
