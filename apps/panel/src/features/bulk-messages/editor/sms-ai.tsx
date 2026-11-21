import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { EditorValues } from "@/features/bulk-messages/form"
import { CampaignAi } from "./campaign-ai"

const A = "bulkMessages.ai"

/**
 * The text's "Yapay zekâ ile öner" (adr/0074 §5 madde 6): three texts,
 * each fitting one SMS with the shop's name and the opt-out line after it
 * (the backend counts as the send counts). The one picked fills the field,
 * after one more question when it has words; an unsaved change.
 */
export function SmsAi({
  form,
  campaignId,
  dirty,
}: {
  form: UseFormReturn<EditorValues>
  campaignId: string
  dirty: boolean
}) {
  const { t } = useTranslation()
  const text = useWatch({ control: form.control, name: "sms_text" })
  return (
    <CampaignAi
      task="campaign_sms"
      campaignId={campaignId}
      dirty={dirty}
      filled={text.trim() !== ""}
      confirm={{ text: t(`${A}.replaceSms`), replace: t(`${A}.replaceSmsAction`) }}
      onUse={(suggestion, candidate) => {
        form.setValue("sms_text", candidate ?? suggestion.text, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }}
    />
  )
}
