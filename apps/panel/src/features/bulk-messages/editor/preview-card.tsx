import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { EditorValues } from "@/features/bulk-messages/form"
import { GREETING } from "@/features/bulk-messages/sms"
import { fillShopText } from "@/features/settings/shop-tokens"
import type { SmsRules } from "./use-sms-rules"

const P = "bulkMessages.preview"
const NAME = /\{ad\}/gu

/**
 * How it reads where it lands (adr/0050 §10): an e-mail as a line in the
 * inbox (sender, subject, preview line), a text as the bubble a phone
 * shows, its footer added. The whole e-mail is seen with a test send.
 */
export function PreviewCard({
  form,
  rules,
}: {
  form: UseFormReturn<EditorValues>
  rules: SmsRules
}) {
  const { t } = useTranslation()
  const [channel, subject, preheader, smsText] = useWatch({
    control: form.control,
    name: ["channel", "subject", "preheader", "sms_text"],
  })
  const fill = (text: string) => fillShopText(text, rules.values).replace(NAME, () => GREETING)
  const sender = rules.values["mağaza_adı"] ?? t("bulkMessages.sms.shopFallback")
  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(channel === "sms" ? `${P}.smsHint` : `${P}.emailHint`)}
    >
      {!rules.ready ? (
        <Skeleton className="h-24" />
      ) : channel === "sms" ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted p-3" aria-label={t(`${P}.sms`)}>
          <span className="text-xs text-muted-foreground">{sender}</span>
          <p className="max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-card px-3 py-2 text-[13px] break-words whitespace-pre-wrap shadow-card">
            {rules.measure(smsText)?.text ?? ""}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 rounded-lg border p-3" aria-label={t(`${P}.inbox`)}>
          <span className="truncate text-sm font-semibold">{sender}</span>
          <span className="truncate text-[13px] font-medium">
            {subject.trim() === "" ? t(`${P}.noSubject`) : fill(subject)}
          </span>
          <span className="truncate text-[13px] text-muted-foreground">
            {preheader.trim() === "" ? t(`${P}.noPreheader`) : fill(preheader)}
          </span>
        </div>
      )}
    </SectionCard>
  )
}
