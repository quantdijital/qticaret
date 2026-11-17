import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import type { AccountActions } from "@/features/settings/account-actions"
import { SecretField } from "@/features/settings/components/account-form"
import { AiDataNote } from "@/features/settings/components/ai-data-note"

const C = "ai.card"

/**
 * An AI service's key in one standard dialog (adr/0071 §3, §10): the key,
 * written once and never filled back, and where the data goes, so the
 * shop agrees knowing it. Saving asks the service first; a refusal stays
 * in the dialog. The owner's alone (`accounts`).
 */
export function AiKeyDialog({
  service,
  name,
  dataNoteKey,
  stored,
  actions,
  onClose,
}: {
  service: string
  name: string
  dataNoteKey: string
  stored: boolean
  actions: AccountActions
  onClose: () => void
}) {
  const { t } = useTranslation()
  // Never from the server: a key is written, not read, so the field always starts empty
  const form = useForm<{ api_key: string }>({ defaultValues: { api_key: "" } })
  const { errors, isDirty } = form.formState

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(stored ? `${C}.changeTitle` : `${C}.connectTitle`, { name })}
      description={t(`${C}.dialogDescription`, { name })}
      size="sm"
      dirty={isDirty}
      saving={actions.save.isPending}
      submitLabel={t(`${C}.save`)}
      onSubmit={() => {
        void form.handleSubmit(async ({ api_key }) => {
          if (await actions.submit({ settings: {}, secrets: { api_key: api_key.trim() } })) {
            form.reset({ api_key: "" })
            onClose()
          }
        })()
      }}
    >
      <DialogBody>
        <SecretField
          id={`ai-key-${service}`}
          label={t(`${C}.key`)}
          name={name}
          kept={false}
          hint={t(`${C}.keyHint`, { name })}
          error={errors.api_key ? t(`${C}.keyRequired`) : undefined}
          registration={form.register("api_key", {
            validate: (value) => value.trim() !== "",
          })}
        />
        <AiDataNote dataNoteKey={dataNoteKey} name={name} />
        {actions.failure ? (
          <Alert variant="destructive">
            <AlertDescription>{actions.failure}</AlertDescription>
          </Alert>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
