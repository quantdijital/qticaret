import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useUpdateBulkMessage } from "@/features/bulk-messages/api/bulk-messages"
import { refusalKey } from "@/features/bulk-messages/api/save-draft"
import type { BulkMessage } from "@/features/bulk-messages/api/types"
import { BulkActions } from "@/features/bulk-messages/components/bulk-actions"
import { BulkStatusBadge } from "@/features/bulk-messages/components/bulk-status"
import { LineTabs } from "@/features/bulk-messages/components/line-tabs"
import { editorSchema, missingContent, requestOf, valuesOf } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { AudienceSources } from "./audience-sources"
import { AudienceSummary } from "./audience-summary"
import { EmailContent } from "./email-content"
import { GeneralCard } from "./general-card"
import { PreviewCard } from "./preview-card"
import { SendCard } from "./send-card"
import { SmsContent } from "./sms-content"
import { TestSendCard } from "./test-send-card"
import { useAudiencePreview } from "./use-audience-preview"
import { storedSmsParts, useRenderedPreview } from "./use-rendered-preview"
import { useSmsRules } from "./use-sms-rules"

const E = "bulkMessages.editor"

type Tab = "audience" | "content" | "send"

/** The tab a refused field sits on, so a failed save shows why. */
const tabOf = (errors: FieldErrors<EditorValues>): Tab | null =>
  errors.audience
    ? "audience"
    : errors.subject || errors.preheader || errors.body || errors.sms_text
      ? "content"
      : null

/** The backend's refusals the panel cannot foresee, by the field they belong to. */
const FIELD_REFUSALS: Record<string, { field: "sms_text"; message: string }> = {
  // Counted at the longest name with the links' utm: the typing count is only a guide
  "campaigns.sms_too_long": { field: "sms_text", message: "bulkMessages.errors.smsTooLongStored" },
}

/**
 * A draft (adr/0050 §10): its name and channel above, then its audience,
 * its content and the test and send in tabs; beside them the live count
 * and how it reads where it lands. One save for the whole draft; a test
 * or a send goes with what is saved, so it waits for the save.
 */
export function BulkEditor({ campaign }: { campaign: BulkMessage }) {
  const { t } = useTranslation()
  const rules = useSmsRules()
  const update = useUpdateBulkMessage(campaign.id)
  const [tab, setTab] = useState<Tab>("audience")
  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema((text) => rules.measure(text)?.length.parts ?? null)),
    defaultValues: valuesOf(campaign),
  })
  const preview = useAudiencePreview(campaign.id, form)
  const rendered = useRenderedPreview(campaign)
  const [channel, subject, body, smsText] = useWatch({
    control: form.control,
    name: ["channel", "subject", "body", "sms_text"],
  })
  const dirty = form.formState.isDirty
  const missing = missingContent({ channel, subject, body, sms_text: smsText })
  const blocked = dirty
    ? t(`${E}.unsaved`)
    : missing.length > 0
      ? t(`${E}.incomplete`, {
          fields: missing.map((field) => t(`${E}.missing.${field}`)).join(", "),
        })
      : null
  const eligible = preview.query.data?.eligible
  const sendBlocked =
    blocked ??
    (preview.empty || (eligible === 0 && !preview.stale) ? t(`${E}.emptyAudience`) : null)
  const save = form.handleSubmit(
    (values) => {
      update.mutate(requestOf(values), {
        onSuccess: (saved) => {
          form.reset(valuesOf(saved), FULL_RESET)
          toast.success(t(`${E}.saved`))
        },
        onError: (failure) => {
          const refusal = FIELD_REFUSALS[refusalKey(failure) ?? ""]
          if (refusal) {
            setTab("content")
            form.setError(refusal.field, { message: refusal.message })
            return
          }
          toast.error(errorText(t, failure))
        },
      })
    },
    (errors) => {
      const where = tabOf(errors)
      if (where) {
        setTab(where)
      }
      toast.error(t(`${E}.invalid`))
    }
  )
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <LeaveGuard when={dirty && !update.isPending} />
      <PageHeader
        back={{ to: "/bulk-messages", label: t("bulkMessages.title") }}
        title={campaign.name}
        badge={<BulkStatusBadge status={campaign.status} />}
        action={
          <>
            {dirty ? (
              <Button
                variant="ghost"
                disabled={update.isPending}
                onClick={() => {
                  form.reset(valuesOf(campaign), FULL_RESET)
                }}
              >
                {t("common.reset")}
              </Button>
            ) : null}
            <Button disabled={!dirty || update.isPending} onClick={() => void save()}>
              {update.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
            <BulkActions campaign={campaign} />
          </>
        }
      />
      <PageGrid>
        <PageColumn span={8}>
          <GeneralCard form={form} utmCampaign={campaign.utm_campaign} />
          <LineTabs
            label={t(`${E}.parts`)}
            value={tab}
            onChange={setTab}
            tabs={[
              {
                key: "audience",
                label: t(`${E}.tabs.audience`),
                content: <AudienceSources form={form} />,
              },
              {
                key: "content",
                label: t(`${E}.tabs.content`),
                content:
                  channel === "sms" ? (
                    <SmsContent
                      form={form}
                      rules={rules}
                      stored={{ text: campaign.sms_text, parts: storedSmsParts(rendered) }}
                    />
                  ) : (
                    <EmailContent form={form} />
                  ),
              },
              {
                key: "send",
                label: t(`${E}.tabs.send`),
                content: (
                  <div className="grid items-stretch gap-[var(--grid-gap)] lg:grid-cols-2">
                    <TestSendCard id={campaign.id} channel={channel} blocked={blocked} />
                    <SendCard
                      id={campaign.id}
                      channel={channel}
                      preview={preview.query.data}
                      hours={rules.hours}
                      blocked={sendBlocked}
                    />
                  </div>
                ),
              },
            ]}
          />
        </PageColumn>
        <PageColumn span={4} sticky>
          <AudienceSummary state={preview} />
          <PreviewCard
            campaign={campaign}
            form={form}
            sender={rules.shopName}
            rendered={rendered}
          />
        </PageColumn>
      </PageGrid>
    </div>
  )
}
