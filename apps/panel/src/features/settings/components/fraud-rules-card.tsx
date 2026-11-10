import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useCan } from "@/features/auth/api/staff"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { SecuritySettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import {
  formatMoneyInput,
  parseCountInput,
  parseMoneyInput,
} from "@qticaret/admin-ui/lib/money-input"

const C = "settings.security.fraud"

/**
 * When an order waits for a person (F15.6, adr/0044 §3): the score that
 * holds it, and the total that makes a first order count as high. The
 * owner's to change; the others see them.
 */
export function FraudRulesCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const owner = useCan("security")
  const section = useQuery(sectionQuery<SecuritySettings>("security"))
  const save = useSaveSection<SecuritySettings>("security")
  const [score, setScore] = useState<string | null>(null)
  const [amount, setAmount] = useState<string | null>(null)
  const values = section.data?.values
  const scoreText = score ?? (values ? String(values.fraud_review_score) : "")
  const amountText = amount ?? (values ? formatMoneyInput(values.fraud_high_amount / 100) : "")
  const scoreValue = parseCountInput(scoreText)
  const amountValue = parseMoneyInput(amountText)
  const valid = scoreValue !== null && scoreValue >= 10 && scoreValue <= 200 && amountValue !== null
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.hint`)} className={className}>
      {values ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (scoreValue === null || amountValue === null) {
              return
            }
            save.mutate(
              { fraud_review_score: scoreValue, fraud_high_amount: Math.round(amountValue * 100) },
              {
                onSuccess: () => {
                  setScore(null)
                  setAmount(null)
                  toast.success(t(`${C}.saved`))
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="fraud-score" className="text-sm font-medium">
              {t(`${C}.score`)}
            </label>
            <NumberField
              min={10}
              max={200}
              step={10}
              id="fraud-score"
              className="w-40"
              value={scoreText}
              disabled={!owner}
              aria-invalid={scoreValue === null || undefined}
              onChange={(event) => {
                setScore(event.target.value.trim())
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="fraud-amount" className="text-sm font-medium">
              {t(`${C}.amount`)}
            </label>
            <NumberField
              decimals={2}
              min={0}
              step={100}
              id="fraud-amount"
              className="w-40"
              value={amountText}
              disabled={!owner}
              aria-invalid={amountValue === null || undefined}
              onChange={(event) => {
                setAmount(event.target.value)
              }}
            />
          </div>
          {owner ? (
            <Button
              type="submit"
              disabled={!valid || (score === null && amount === null) || save.isPending}
            >
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          ) : null}
        </form>
      ) : (
        <Skeleton className="h-16" />
      )}
    </SectionCard>
  )
}
