import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { messagePreviewQuery, messageTemplatesQuery } from "@/features/settings/api/messaging"
import { errorText } from "@/lib/errors"

const P = "settings.notifications.templates"

/**
 * Settings > Notifications > Personel uyarıları: how each message the
 * team gets reads (F9.3), with made-up values in the shop's own logo,
 * colour and name; the customers' messages are in their own tab, to edit
 * (adr/0036 Ek 2026-11-10). The e-mail shows in a sandboxed frame that
 * runs nothing and opens nothing. Nothing is sent.
 */
export function TemplatePreviewCard() {
  const { t } = useTranslation()
  const list = useQuery(messageTemplatesQuery())
  const templates = (list.data?.templates ?? []).filter((template) =>
    template.name.startsWith("staff.")
  )
  const [chosen, setChosen] = useState<string | null>(null)
  const name = chosen ?? templates[0]?.name ?? ""
  const preview = useQuery(messagePreviewQuery(name))
  const message = preview.data?.name === name ? preview.data : undefined
  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.description`)}
      action={
        templates.length > 0 ? (
          <Select value={name} onValueChange={setChosen}>
            <SelectTrigger className="w-64" aria-label={t(`${P}.choose`)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.name} value={template.name}>
                  {t(`${P}.names.${template.name}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      {preview.isError ? (
        <ErrorState text={errorText(t, preview.error)} onRetry={() => void preview.refetch()} />
      ) : !message ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={message.kind === "commercial" ? "warning" : "neutral"}>
              {t(`${P}.kind.${message.kind}`)}
            </StatusBadge>
            <span className="text-[13px] text-muted-foreground">
              {t(`${P}.kindHint.${message.kind}`)}
            </span>
          </div>
          {message.email ? (
            <section className="flex flex-col gap-2" aria-label={t(`${P}.email`)}>
              <h3 className="text-[13px] font-medium">{t(`${P}.email`)}</h3>
              <p className="text-sm">
                <span className="text-muted-foreground">{t(`${P}.subject`)}: </span>
                {message.email.subject}
              </p>
              <iframe
                title={t(`${P}.emailFrame`, { name: t(`${P}.names.${message.name}`) })}
                sandbox=""
                srcDoc={message.email.html}
                className="h-[560px] w-full rounded-md border bg-white"
              />
            </section>
          ) : null}
          {message.sms ? (
            <section className="flex flex-col gap-2" aria-label={t(`${P}.sms`)}>
              <h3 className="text-[13px] font-medium">{t(`${P}.sms`)}</h3>
              <p className="max-w-md rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {message.sms}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`${P}.smsLength`, { count: message.sms.length })}
              </p>
            </section>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
