import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Link2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { paymentLinkQuery } from "@/features/payment-links/api/payment-links"
import { useLinkAccess } from "./use-link-access"

const CHIP =
  "inline-flex h-6 items-center gap-1.5 rounded-full border bg-card px-2 text-xs font-medium whitespace-nowrap"

/**
 * Beside an order's state (adr/0051 §13): "Ödeme bağlantısı PL-1042",
 * opening the link for those who may. The number is the one the order
 * keeps when it has it (nothing is read for it, the feature on or off);
 * else the link's own, read while the shop has payment links on.
 */
export function PaymentLinkChip({
  linkId,
  number: kept = null,
}: {
  linkId: string
  /** `metadata.qt_payment_link_number` (`orderPaymentLinkNumber`). */
  number?: string | null
}) {
  const { t } = useTranslation()
  const gate = useLinkAccess()
  const flagOn = gate.access === "ok" || gate.access === "denied"
  const link = useQuery({ ...paymentLinkQuery(linkId), enabled: flagOn && kept === null })
  const number = kept ?? link.data?.number
  const body = (
    <>
      <Link2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {number ? t("paymentLinks.chip", { number }) : t("paymentLinks.chipUnknown")}
    </>
  )
  return gate.access === "ok" && number ? (
    <Link to="/payment-links/$id" params={{ id: linkId }} className={`${CHIP} hover:bg-muted`}>
      {body}
    </Link>
  ) : (
    <span className={CHIP}>{body}</span>
  )
}
