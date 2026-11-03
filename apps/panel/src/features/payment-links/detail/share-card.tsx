import { useQuery } from "@tanstack/react-query"
import { Loader2, Mail, MessageCircle, Smartphone } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { linkShareQuery, useResendPaymentLink } from "@/features/payment-links/api/payment-links"
import type { ResendChannel, ResendOutcomes } from "@/features/payment-links/api/types"
import { errorText } from "@/lib/errors"
import { CopyField } from "./copy-field"

const S = "paymentLinks.share"

/** Each channel's outcome in words: "E-posta gönderildi.", "SMS: hesap bağlı değil." */
function Outcomes({ outcomes }: { outcomes: ResendOutcomes }) {
  const { t } = useTranslation()
  return (
    <ul role="status" className="flex flex-col gap-1 text-[13px]">
      {(Object.entries(outcomes) as [ResendChannel, string][]).map(([channel, outcome]) => (
        <li
          key={channel}
          className={outcome === "sent" ? "text-success-text" : "text-warning-text"}
        >
          {t(`${S}.outcome`, {
            channel: t(`${S}.channels.${channel}`),
            result: t(`${S}.outcomes.${outcome}`, { defaultValue: t(`${S}.outcomes.failed`) }),
          })}
        </li>
      ))}
    </ul>
  )
}

/**
 * Paylaş (adr/0051 §7): the link and the message to copy, WhatsApp opened
 * in the staff member's own app with the text filled in, and the link sent
 * by e-mail or SMS from the shop (once in ten minutes). Nothing once the
 * link no longer opens.
 */
export function ShareCard({ linkId, created }: { linkId: string; created: boolean }) {
  const { t } = useTranslation()
  const share = useQuery(linkShareQuery(linkId))
  const resend = useResendPaymentLink(linkId)
  const [outcomes, setOutcomes] = useState<ResendOutcomes | null>(null)
  const send = (channel: ResendChannel) => {
    setOutcomes(null)
    resend.mutate([channel], {
      onSuccess: (result) => {
        setOutcomes(result)
        if (Object.values(result).includes("sent")) {
          toast.success(t(`${S}.sent`))
        }
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const data = share.data
  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={t(created ? `${S}.created` : `${S}.description`)}
    >
      {share.isError ? (
        <ErrorState text={errorText(t, share.error)} onRetry={() => void share.refetch()} />
      ) : !data ? (
        <LoadingRows rows={3} />
      ) : (
        <div className="flex flex-col gap-4">
          {data.url ? (
            <>
              <CopyField id="link-share-url" label={t(`${S}.url`)} value={data.url} />
              {data.sms_text ? (
                <CopyField
                  id="link-share-text"
                  label={t(`${S}.text`)}
                  value={data.sms_text}
                  multiline
                />
              ) : null}
              {data.whatsapp_url ? (
                <Button asChild variant="outline">
                  <a href={data.whatsapp_url} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    {t(`${S}.whatsapp`)}
                  </a>
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t(`${S}.closed`)}</p>
          )}
          <div className="flex flex-col gap-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={data.email_sent ? "success" : "neutral"}>
                {t(data.email_sent ? `${S}.emailSent` : `${S}.emailNotSent`)}
              </StatusBadge>
              <StatusBadge tone={data.sms_sent ? "success" : "neutral"}>
                {t(data.sms_sent ? `${S}.smsSent` : `${S}.smsNotSent`)}
              </StatusBadge>
            </div>
            {data.url ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(["email", "sms"] as const).map((channel) => {
                    const sent = channel === "email" ? data.email_sent : data.sms_sent
                    const Icon = channel === "email" ? Mail : Smartphone
                    return (
                      <Button
                        key={channel}
                        type="button"
                        variant="outline"
                        disabled={resend.isPending}
                        onClick={() => {
                          send(channel)
                        }}
                      >
                        {resend.isPending && resend.variables[0] === channel ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Icon />
                        )}
                        {t(`${S}.${sent ? "resend" : "send"}.${channel}`)}
                      </Button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{t(`${S}.gap`)}</p>
              </>
            ) : null}
            {outcomes ? <Outcomes outcomes={outcomes} /> : null}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
