import { Monitor, Smartphone } from "lucide-react"
import { useState } from "react"
import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import type { BulkMessage } from "@/features/bulk-messages/api/types"
import { contentKey, valuesOf } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"
import { errorText } from "@/lib/errors"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { EmailFrame } from "./email-frame"
import type { PreviewDevice } from "./frame-document"
import type { RenderedPreviewState } from "./use-rendered-preview"

const P = "bulkMessages.preview"

function DeviceToggle({
  value,
  onChange,
}: {
  value: PreviewDevice
  onChange: (next: PreviewDevice) => void
}) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      aria-label={t(`${P}.device.label`)}
      value={value}
      onValueChange={(next) => {
        if (next) {
          onChange(next as PreviewDevice)
        }
      }}
    >
      <ToggleGroupItem
        value="desktop"
        aria-label={t(`${P}.device.desktop`)}
        title={t(`${P}.device.desktop`)}
      >
        <Monitor />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="phone"
        aria-label={t(`${P}.device.phone`)}
        title={t(`${P}.device.phone`)}
      >
        <Smartphone />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

/** The inbox line (sender, subject, preview line) above the e-mail itself. */
function EmailPreview({
  email,
  sender,
  device,
}: {
  email: { subject: string; preheader: string; html: string }
  sender: string
  device: PreviewDevice
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 rounded-lg border p-3" aria-label={t(`${P}.inbox`)}>
        <span className="truncate text-sm font-semibold">{sender}</span>
        <span className="truncate text-[13px] font-medium">
          {email.subject.trim() === "" ? t(`${P}.noSubject`) : email.subject}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {email.preheader.trim() === "" ? t(`${P}.noPreheader`) : email.preheader}
        </span>
      </div>
      <EmailFrame html={email.html} device={device} title={t(`${P}.frame`)} />
    </div>
  )
}

/** The bubble a phone shows, and the parts the backend counts the text at its longest. */
function SmsPreview({ sms, sender }: { sms: { text: string; parts: number }; sender: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted p-3" aria-label={t(`${P}.sms`)}>
      <span className="text-xs text-muted-foreground">{sender}</span>
      <p className="max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-card px-3 py-2 text-[13px] break-words whitespace-pre-wrap shadow-card">
        {sms.text}
      </p>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t(`${P}.parts`, { count: sms.parts })}
      </span>
    </div>
  )
}

/**
 * How it reads where it lands (adr/0050 §10): the stored campaign made as
 * a send makes it, the staff member as its sample recipient. An e-mail in
 * a frame at a desktop's or a phone's width, its subject and preview line
 * above; a text as the bubble a phone shows. Changes not yet saved are
 * not in it, and it says so.
 */
export function PreviewCard({
  campaign,
  form,
  sender,
  rendered,
}: {
  campaign: BulkMessage
  form: UseFormReturn<EditorValues>
  sender: string
  rendered: RenderedPreviewState
}) {
  const { t } = useTranslation()
  const [device, setDevice] = useState<PreviewDevice>("desktop")
  const [channel, subject, preheader, body, smsText] = useWatch({
    control: form.control,
    name: ["channel", "subject", "preheader", "body", "sms_text"],
  })
  const unsaved =
    contentKey({ channel, subject, preheader, body, sms_text: smsText }) !==
    contentKey(valuesOf(campaign))
  const { query, stale } = rendered
  const data = query.data
  const email = campaign.channel === "email" && data && "html" in data ? data : null
  const sms = campaign.channel === "sms" && data && "text" in data ? data : null
  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(campaign.channel === "sms" ? `${P}.smsHint` : `${P}.emailHint`)}
      action={
        campaign.channel === "email" ? <DeviceToggle value={device} onChange={setDevice} /> : null
      }
    >
      <div className="flex flex-col gap-3">
        {unsaved ? <p className="text-[13px] text-warning-text">{t(`${P}.unsaved`)}</p> : null}
        {query.isError ? (
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        ) : email || sms ? (
          <div
            aria-busy={stale ? true : undefined}
            className={cn("transition-opacity", stale || unsaved ? "opacity-60" : "")}
          >
            {email ? (
              <EmailPreview email={email} sender={sender} device={device} />
            ) : sms ? (
              <SmsPreview sms={sms} sender={sender} />
            ) : null}
          </div>
        ) : (
          <Skeleton className="h-64" />
        )}
      </div>
    </SectionCard>
  )
}
