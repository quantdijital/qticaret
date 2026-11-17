import { ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"

/**
 * Where a service takes the data and whether it trains on it (adr/0071
 * §10), in a line; the longer account behind (i). The registry names the
 * text (`data_note_key`, `ai.data_note.<id>`); the longer one sits beside
 * it under `ai.data_detail.<id>`. Under it, the same for every service:
 * no personal data goes.
 */
export function AiDataNote({ dataNoteKey, name }: { dataNoteKey: string; name: string }) {
  const { t } = useTranslation()
  const detail = t(dataNoteKey.replace(/^ai\.data_note\./, "ai.data_detail."), {
    defaultValue: "",
  })
  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 px-3 py-2.5 text-[13px]">
      <p className="flex items-start gap-1.5">
        <span className="font-medium">{t("ai.card.dataTitle")}</span>
        {detail ? (
          <InfoTip name={t("ai.card.dataTip", { name })} hint={detail} className="shrink-0" />
        ) : null}
      </p>
      <p className="text-muted-foreground">{t(dataNoteKey, { defaultValue: "" })}</p>
      <p className="flex items-start gap-1.5 text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success-text" />
        <span>{t("ai.card.noPersonalData")}</span>
      </p>
    </div>
  )
}
