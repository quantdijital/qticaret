import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import { useRevealTravelerDocument } from "@/features/products/api/booking"
import type { SlotTraveler } from "@/features/products/api/booking"
import { errorText } from "@/lib/errors"
import { isReauthCancelled } from "@/lib/reauth"
import { birthDateText, countryText } from "./traveler-text"

const T = "products.booking.travelers"

/** How long a shown number stays on the screen before it is masked again. */
export const SHOWN_FOR_MS = 30_000

/**
 * The traveler's number: masked, and for owner and admin a "Numarayı
 * göster" that proves them again (428 asks, as the tax number) and is
 * recorded; shown, it is masked again after `SHOWN_FOR_MS` or on "Gizle".
 */
function TravelerNumber({ traveler }: { traveler: SlotTraveler }) {
  const { t } = useTranslation()
  const mayReveal = useCan("travelerDocuments")
  const reveal = useRevealTravelerDocument()
  const shown = reveal.data?.document_no ?? null
  const { reset } = reveal
  useEffect(() => {
    if (shown === null) {
      return
    }
    const timer = window.setTimeout(reset, SHOWN_FOR_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [shown, reset])
  if (!traveler.document_masked) {
    return null
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono" aria-live="polite">
        {shown ?? traveler.document_masked}
      </span>
      {mayReveal ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          disabled={reveal.isPending}
          onClick={() => {
            if (shown !== null) {
              reset()
              return
            }
            reveal.mutate(traveler.id, {
              onError: (failure) => {
                if (!isReauthCancelled(failure)) {
                  toast.error(errorText(t, failure))
                }
              },
            })
          }}
        >
          {t(shown !== null ? `${T}.hide` : `${T}.reveal`)}
        </Button>
      ) : null}
    </span>
  )
}

/**
 * A booking's travelers on this departure (adr/0076 §7): name, birth date,
 * nationality and the number masked; none entered yet says so (they reach
 * the booking with the order, or the reconcile job brings them).
 */
export function SlotTravelers({ travelers }: { travelers: readonly SlotTraveler[] }) {
  const { t, i18n } = useTranslation()
  if (travelers.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{t(`${T}.none`)}</p>
  }
  return (
    <ol className="flex flex-col gap-1 text-sm" aria-label={t(`${T}.title`)}>
      {travelers.map((traveler) => {
        const facts = [
          birthDateText(traveler.birth_date, i18n.language),
          countryText(traveler.nationality, i18n.language),
        ].filter((fact): fact is string => fact !== null)
        return (
          <li key={traveler.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-medium">
              {traveler.first_name} {traveler.last_name}
            </span>
            {facts.length > 0 ? (
              <span className="text-muted-foreground">{facts.join(" · ")}</span>
            ) : null}
            <TravelerNumber traveler={traveler} />
          </li>
        )
      })}
    </ol>
  )
}
