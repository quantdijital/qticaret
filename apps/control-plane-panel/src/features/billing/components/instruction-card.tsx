import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { PAYMENT_INSTRUCTION_MAX } from "@qticaret/types/control-plane"
import { useMe } from "@/features/auth/api"
import { billingSettingsQuery, isOwner, useSetInstruction } from "@/features/billing/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

function InstructionDialog({ current, onClose }: { current: string; onClose: () => void }) {
  const { t } = useTranslation()
  const change = useSetInstruction()
  const [value, setValue] = useState(current)
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("billing.instruction.title")}
      description={t("billing.instruction.dialogText")}
      dirty={value !== current}
      saving={change.isPending}
      canSubmit={value !== current}
      submitLabel={t("common.save")}
      onSubmit={() => {
        setFailure(null)
        change.mutate(value, {
          onSuccess: () => {
            toast.success(t("billing.instruction.done"))
            onClose()
          },
          onError: (error) => {
            if (!isStepUpCancelled(error)) {
              setFailure(errorText(t, error))
            }
          },
        })
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-instruction">{t("billing.instruction.label")}</Label>
          <Textarea
            id="payment-instruction"
            rows={6}
            maxLength={PAYMENT_INSTRUCTION_MAX}
            value={value}
            placeholder={t("billing.instruction.placeholder")}
            onChange={(event) => {
              setValue(event.target.value)
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("billing.instruction.help")}</p>
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}

/**
 * The platform's payment instruction (Ek C16): the text every shop's
 * Abonelik page and reminder shows. Every role reads it; the owner edits
 * it behind a step-up.
 */
export function InstructionCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const me = useMe()
  const query = useQuery(billingSettingsQuery())
  const [editing, setEditing] = useState(false)
  const settings = query.data
  return (
    <SectionCard
      title={t("billing.instruction.title")}
      description={t("billing.instruction.text")}
      className={className}
      action={
        isOwner(me?.role) && settings ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(true)
            }}
          >
            {t("common.edit")}
          </Button>
        ) : undefined
      }
    >
      {settings ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="whitespace-pre-line">
            {settings.payment_instruction ?? (
              <span className="text-muted-foreground">{t("billing.instruction.none")}</span>
            )}
          </p>
          {settings.updated_at ? (
            <p className="text-[13px] text-muted-foreground">
              {t("billing.instruction.updated", {
                at: formatDateTime(settings.updated_at),
                by: settings.updated_by ?? t("billing.system"),
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <Skeleton className="h-24" />
      )}
      {editing && settings ? (
        <InstructionDialog
          current={settings.payment_instruction ?? ""}
          onClose={() => {
            setEditing(false)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
