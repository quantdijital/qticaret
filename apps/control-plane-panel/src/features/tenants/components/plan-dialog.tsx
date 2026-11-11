import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { plansQuery } from "@/features/packages/api"
import { NO_PACKAGE, PackagePicker } from "@/features/packages/components/package-picker"
import { useAssignPlan } from "@/features/tenants/mutations"
import { errorText } from "@/lib/errors"

/**
 * The shop's package (owner, operator): one of those on sale, or none. An
 * archived package stays offered to the shop already on it only. The new
 * limits reach the shop with its next plan document (C9).
 */
export function PlanDialog({
  tenantId,
  current,
  onClose,
}: {
  tenantId: string
  current: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const plans = useQuery(plansQuery())
  const assign = useAssignPlan(tenantId)
  const [chosen, setChosen] = useState(current ?? NO_PACKAGE)
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("plan.dialogTitle")}
      description={t("plan.dialogText")}
      dirty={chosen !== (current ?? NO_PACKAGE)}
      saving={assign.isPending}
      onSubmit={() => {
        setFailure(null)
        assign.mutate(chosen === NO_PACKAGE ? null : chosen, {
          onSuccess: () => {
            toast.success(t("plan.saved"))
            onClose()
          },
          onError: (error) => {
            setFailure(errorText(t, error))
          },
        })
      }}
    >
      <DialogBody>
        <p id="plan-choice-label" className="sr-only">
          {t("plan.dialogTitle")}
        </p>
        <PackagePicker
          id="plan-choice"
          plans={plans.data?.plans ?? []}
          value={chosen}
          current={current}
          onChange={setChosen}
        />
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
