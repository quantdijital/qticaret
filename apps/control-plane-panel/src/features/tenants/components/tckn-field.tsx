import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { revealTckn } from "@/features/tenants/mutations"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

// Shown for a minute, then masked again: a screen left open does not keep it
const SHOWN_MS = 60_000

/**
 * A sole proprietor's TCKN, masked; "Göster" proves the member again
 * (step-up) and asks the control plane, which records the read before it
 * answers (adr/0061 §3.5). The number lives in this field's state only,
 * never in the query cache, and goes after a minute or on "Gizle".
 */
export function TcknField({
  tenantId,
  masked,
  canReveal,
}: {
  tenantId: string
  masked: string
  canReveal: boolean
}) {
  const { t } = useTranslation()
  const [shown, setShown] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (shown === null) {
      return
    }
    const timer = setTimeout(() => {
      setShown(null)
    }, SHOWN_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [shown])
  const reveal = async () => {
    setBusy(true)
    try {
      setShown((await revealTckn(tenantId)).tckn)
    } catch (error) {
      if (!isStepUpCancelled(error)) {
        toast.error(errorText(t, error))
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono tabular-nums">{shown ?? masked}</span>
      {canReveal ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          disabled={busy}
          onClick={() => {
            if (shown) {
              setShown(null)
            } else {
              void reveal()
            }
          }}
        >
          {t(shown ? "company.tcknHide" : "company.tcknShow")}
        </Button>
      ) : null}
    </span>
  )
}
