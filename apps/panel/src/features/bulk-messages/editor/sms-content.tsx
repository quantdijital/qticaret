import { Link } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"
import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { LIMITS } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"
import { SMS_MAX_PARTS } from "@/features/bulk-messages/sms"
import { TokenSlot } from "@/features/settings/components/shop-token-menu"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useNameToken } from "./name-token"
import type { SmsRules } from "./use-sms-rules"

const S = "bulkMessages.sms"

/** The stored text and the backend's count of it; `parts` null until that count is in. */
export interface StoredSms {
  text: string | null
  parts: number | null
}

/**
 * While typing, the panel's own count: a guide (`{ad}` as the greeting,
 * links as typed). For the stored text, the backend's: at the longest
 * first name with the shop links' utm, the number its save and send check.
 * Red past three parts; the encoding said when it costs room.
 */
export function SmsCounter({
  text,
  rules,
  stored,
}: {
  text: string
  rules: SmsRules
  stored: StoredSms
}) {
  const { t } = useTranslation()
  const measured = rules.measure(text)
  if (!measured) {
    return <Skeleton className="h-4 w-40" />
  }
  const { length } = measured
  const typed = text.trim()
  const exact = stored.parts !== null && typed !== "" && typed === stored.text ? stored.parts : null
  const over = (exact ?? length.parts) > SMS_MAX_PARTS
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p
        className={cn(
          "text-xs tabular-nums",
          over ? "text-destructive-text" : "text-muted-foreground"
        )}
      >
        {exact === null
          ? t(`${S}.count`, {
              chars: formatCount(length.units),
              parts: length.parts,
              max: SMS_MAX_PARTS,
              perPart: length.perPart,
            })
          : t(`${S}.countStored`, { parts: exact, max: SMS_MAX_PARTS })}
      </p>
      {length.encoding === "ucs2" ? (
        <p className="text-xs text-warning-text">{t(`${S}.ucs2`)}</p>
      ) : null}
    </div>
  )
}

/**
 * A bulk text (adr/0050 §4): plain words, three SMS at most with the end
 * the backend adds to every one (the shop's name and the opt-out line).
 * The save refuses a text too long at its longest; that refusal shows
 * under the field. Without an opt-out line no SMS campaign starts.
 */
export function SmsContent({
  form,
  rules,
  stored,
}: {
  form: UseFormReturn<EditorValues>
  rules: SmsRules
  stored: StoredSms
}) {
  const { t } = useTranslation()
  const extra = useNameToken()
  const text = useWatch({ control: form.control, name: "sms_text" })
  const error = form.formState.errors.sms_text?.message
  return (
    <SectionCard title={t(`${S}.title`)} description={t(`${S}.description`)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="bulk-sms" className="text-sm font-medium">
            {t(`${S}.text`)}
            <span className="ml-0.5 text-destructive-text">*</span>
          </label>
          <TokenSlot
            fieldId="bulk-sms"
            multiline
            extra={extra}
            onInsert={(next) => {
              form.setValue("sms_text", next, { shouldDirty: true, shouldValidate: true })
            }}
          >
            <Textarea
              id="bulk-sms"
              rows={5}
              maxLength={LIMITS.sms}
              className="pr-9"
              aria-invalid={error ? true : undefined}
              {...form.register("sms_text")}
            />
          </TokenSlot>
          {error ? (
            <p role="alert" className="text-xs text-destructive-text">
              {t(error, { limit: LIMITS.sms, parts: SMS_MAX_PARTS })}
            </p>
          ) : null}
          <SmsCounter text={text} rules={rules} stored={stored} />
        </div>
        <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 px-3 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">{t(`${S}.footer`)}</span>
          <p className="text-[13px]">{rules.ready ? rules.footer : "…"}</p>
        </div>
        {rules.ready && !rules.optOut ? (
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="flex flex-col items-start gap-1">
              <p>{t(`${S}.optOutMissing`)}</p>
              <Link
                to="/settings/notifications"
                search={{ part: "sms" }}
                className="font-medium text-primary-text underline underline-offset-4"
              >
                {t(`${S}.optOutLink`)}
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </SectionCard>
  )
}
