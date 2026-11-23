import { useState } from "react"
import { ArrowLeftRight, Check, Copy, Landmark } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { PlanSummary } from "@/features/settings/api/plan"

/**
 * How to pay, as the platform writes it (Ek C16): the text in a mono
 * pill with a copy button; under it, one line on changing the package.
 * The payment strip's "Ödeme bilgileri" leads here.
 */
export function PaymentCard({ plan }: { plan: PlanSummary }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const instruction = plan.payment_instruction
  const copy = () => {
    if (!instruction) {
      return
    }
    // Refused without the page's clipboard permission: the text stays selectable
    navigator.clipboard.writeText(instruction).then(
      () => {
        setCopied(true)
        toast.success(t("plan.payment.copied"))
      },
      () => toast.error(t("plan.payment.copyFailed"))
    )
  }
  return (
    <SectionCard title={t("plan.payment.title")}>
      <div className="flex flex-1 flex-col gap-4">
        {instruction ? (
          <div className="relative rounded-md border bg-muted/50 py-3 pr-12 pl-3">
            <p className="font-mono text-[13px] leading-6 break-words whitespace-pre-line">
              {instruction}
            </p>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={copy}
              aria-label={t("plan.payment.copy")}
              title={t("plan.payment.copy")}
              className="absolute top-1.5 right-1.5"
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed py-6 text-muted-foreground">
            <Landmark className="size-6" aria-hidden="true" />
            <span className="text-[13px] font-medium">{t("plan.payment.none")}</span>
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 border-t pt-3 text-[13px]">
          <ArrowLeftRight className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{t("plan.payment.change")}</span>
          <InfoTip name={t("plan.payment.change")} hint={t("plan.payment.changeHint")} />
        </div>
      </div>
    </SectionCard>
  )
}
