import { ResponsiveImage } from "@qticaret/ui"
import type { ShopMarkView, ShopView, Translate } from "@qticaret/ui"

function Marks({ marks, label }: { marks: ShopMarkView[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {marks.map((mark) => (
        <li
          key={mark.key}
          className="rounded-md border border-ink-foreground/20 px-2 py-1 text-[11px] font-medium text-ink-foreground/90"
        >
          {mark.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * The footer's small print beside the identity lines (adr/0046 Ek
 * 2026-11-04): the ETBİS QR code on a white ground (a code needs its
 * quiet zone), the ways to pay and the carriers as text badges (no
 * provider's logo is shipped). Each only when the shop has it.
 */
export function FooterMarks({ shop, t }: { shop: ShopView; t: Translate }) {
  const payments = shop.paymentMarks ?? []
  const carriers = shop.carrierMarks ?? []
  if (!shop.etbisQr && payments.length === 0 && carriers.length === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {shop.etbisQr && (
        <span className="block size-16 shrink-0 rounded-md bg-white p-1">
          <ResponsiveImage image={shop.etbisQr} sizes="64px" className="size-full object-contain" />
        </span>
      )}
      {payments.length > 0 && <Marks marks={payments} label={t("footer.payment_marks")} />}
      {carriers.length > 0 && <Marks marks={carriers} label={t("footer.carrier_marks")} />}
    </div>
  )
}
