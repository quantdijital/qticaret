import { useState } from "react"
import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { AiCandidates } from "@/features/ai/components/ai-candidates"
import { readCampaignEmail, withDraftBody } from "@/features/ai/campaign-text"
import type { AiCampaignEmail } from "@/features/ai/campaign-text"
import { docText } from "@/features/content/doc-text"
import type { EditorValues } from "@/features/bulk-messages/form"
import { CampaignAi } from "./campaign-ai"

const A = "bulkMessages.ai"

/** The e-mail's words as they will read: the subject picked from the list, the preview line, the body. */
export function EmailDraftPreview({
  email,
  subject,
  onSubject,
}: {
  email: AiCampaignEmail
  subject: string
  onSubject: (subject: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3" data-slot="ai-campaign-email">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t(`${A}.subjects`)}</p>
        <AiCandidates candidates={email.subjects} value={subject} onChange={onSubject} />
      </div>
      {email.preheader ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{t(`${A}.preheader`)}</p>
          <p>{email.preheader}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5 border-t pt-2">
        <p className="text-xs font-medium text-muted-foreground">{t(`${A}.body`)}</p>
        {email.paragraphs.map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
    </div>
  )
}

/**
 * The e-mail's "Yapay zekâ ile öner" (adr/0074 §5 madde 6): three subject
 * lines to pick from, a preview line and a short body. "Kullan" puts the
 * picked subject and the preview line in their fields; the body's words go
 * in too, the pictures and cards kept, after one more question when it
 * already has words. All an unsaved change: the editor's Save writes it.
 */
export function EmailAi({
  form,
  campaignId,
  dirty,
}: {
  form: UseFormReturn<EditorValues>
  campaignId: string
  dirty: boolean
}) {
  const { t } = useTranslation()
  const body = useWatch({ control: form.control, name: "body" })
  // The pick belongs to one suggestion: a new one starts at its first subject
  const [picked, setPicked] = useState<{ id: string; subject: string } | null>(null)
  const subjectOf = (id: string, email: AiCampaignEmail) =>
    picked?.id === id && email.subjects.includes(picked.subject)
      ? picked.subject
      : (email.subjects[0] ?? "")
  const set = (name: "subject" | "preheader", value: string) => {
    form.setValue(name, value, { shouldDirty: true, shouldValidate: true })
  }
  return (
    <CampaignAi
      task="campaign_email"
      campaignId={campaignId}
      dirty={dirty}
      filled={docText(body) !== ""}
      confirm={{
        text: t(`${A}.replaceBody`),
        replace: t(`${A}.replaceBodyAction`),
        keep: t(`${A}.keepBody`),
      }}
      preview={(suggestion) => {
        const email = readCampaignEmail(suggestion.text)
        return email ? (
          <EmailDraftPreview
            email={email}
            subject={subjectOf(suggestion.id, email)}
            onSubject={(subject) => {
              setPicked({ id: suggestion.id, subject })
            }}
          />
        ) : (
          <p>{t("ai.suggest.refused")}</p>
        )
      }}
      onUse={(suggestion, _candidate, replace) => {
        const email = readCampaignEmail(suggestion.text)
        if (!email) {
          return
        }
        set("subject", subjectOf(suggestion.id, email))
        if (email.preheader) {
          set("preheader", email.preheader)
        }
        if (replace) {
          form.setValue("body", withDraftBody(body, email.paragraphs), {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        setPicked(null)
      }}
    />
  )
}
