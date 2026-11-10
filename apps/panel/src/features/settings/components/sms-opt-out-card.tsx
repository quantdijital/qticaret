import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { MarketingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const O = "settings.sms.optOut"
const MAX = 80

/**
 * Settings > Messages > SMS: how a person refuses commercial texts (the
 * İYS opt-out line), added after the shop's name to every bulk SMS
 * (adr/0050 §4). Without it no SMS campaign starts. Kept in the marketing
 * settings; empty clears it.
 */
export function SmsOptOutCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<MarketingSettings>("marketing"))
  const save = useSaveSection<MarketingSettings>("marketing")
  const stored = section.data?.values.sms_opt_out_text ?? ""
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? stored
  return (
    <SectionCard title={t(`${O}.title`)} description={t(`${O}.description`)}>
      {section.data ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { sms_opt_out_text: text.trim() === "" ? null : text.trim() },
              {
                onSuccess: () => {
                  setDraft(null)
                  toast.success(t(`${O}.saved`))
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2">
            <label htmlFor="sms-opt-out" className="text-sm font-medium">
              {t(`${O}.label`)}
            </label>
            <Input
              id="sms-opt-out"
              value={text}
              maxLength={MAX}
              placeholder={t(`${O}.placeholder`)}
              aria-describedby="sms-opt-out-hint"
              onChange={(event) => {
                setDraft(event.target.value)
              }}
            />
          </div>
          <Button type="submit" disabled={draft === null || draft === stored || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
          <p id="sms-opt-out-hint" className="w-full text-xs text-muted-foreground">
            {t(`${O}.hint`, { max: MAX })}
          </p>
        </form>
      ) : (
        <Skeleton className="h-16" />
      )}
    </SectionCard>
  )
}
