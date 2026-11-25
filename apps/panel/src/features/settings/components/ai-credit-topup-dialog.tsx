import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { aiCreditsQuery, formatMinorMoney, useRequestCreditTopUp } from "@/features/ai/api/credits"
import type { AiFailure } from "@/features/ai/api/suggestions"
import { errorText } from "@/lib/errors"

const C = "ai.credits"

// The request's refusals said in the panel's own words; the pack's gone one offers a fresh list
const OWN_WORDS = new Set([
  "ai.credits_order_open",
  "ai.credits_pack_unknown",
  "ai.platform_unavailable",
])

const codeOf = (error: unknown): string | null => {
  const code = (error as Partial<AiFailure> | null)?.code
  return typeof code === "string" ? code : null
}

/**
 * "Kredi yükle" (adr/0085 K11): the packs as the server offers them (a
 * name as plain text, its credits, its price), one picked, and a request
 * sent with the pack's id alone. No payment here: the request reaches the
 * platform's staff, who get in touch; the credits come once it is paid.
 * Locked while it is on its way; "Vazgeç" is red as everywhere.
 */
export function AiCreditTopupDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const credits = useQuery(aiCreditsQuery())
  const request = useRequestCreditTopUp()
  // A pick is no edit worth a "discard?" question: closing just closes
  const guard = useDiscardGuard(false)
  const packs = credits.data?.available ? credits.data.packs : []
  const [picked, setPicked] = useState<string | null>(null)
  const chosen = packs.some((pack) => pack.id === picked) ? picked : (packs[0]?.id ?? null)
  const code = request.isError ? codeOf(request.error) : null

  const failure =
    code && OWN_WORDS.has(code)
      ? t(`ai.errors.${code.slice(3)}`)
      : request.isError
        ? errorText(t, request.error)
        : null

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${C}.dialog.title`)}
      description={t(`${C}.dialog.description`)}
      size="sm"
      dirty
      guard={guard}
      saving={request.isPending}
      canSubmit={chosen !== null}
      submitLabel={t(`${C}.dialog.submit`)}
      onSubmit={() => {
        if (chosen === null) {
          return
        }
        request.mutate(chosen, {
          onSuccess: () => {
            onClose()
          },
        })
      }}
    >
      <DialogBody>
        {packs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(`${C}.noPacks`)}</p>
        ) : (
          <RadioGroup
            aria-label={t(`${C}.dialog.packs`)}
            value={chosen ?? ""}
            disabled={request.isPending}
            onValueChange={(value) => {
              setPicked(value)
              request.reset()
            }}
            className="gap-2"
          >
            {packs.map((pack) => (
              <label
                key={pack.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem value={pack.id} />
                <span className="min-w-0 flex-1 break-words">{pack.name}</span>
                <span className="flex shrink-0 flex-col items-end text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {t(`${C}.dialog.packCredits`, { credits: formatCount(pack.credits) })}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMinorMoney(pack.amount, pack.currency)}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        )}
        <div aria-live="polite">
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{failure}</span>
                {code === "ai.credits_pack_unknown" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPicked(null)
                      request.reset()
                      void credits.refetch()
                    }}
                  >
                    {t(`${C}.dialog.refresh`)}
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </DialogBody>
    </FormDialog>
  )
}
