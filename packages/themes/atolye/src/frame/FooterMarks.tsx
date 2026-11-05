import { Banknote, Landmark } from "lucide-react"
import type { CSSProperties } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopMarkView, ShopView, Translate } from "@qticaret/ui"

/** Ways to pay with no company's mark: drawn as an icon beside their name. */
const ICONS: Record<string, typeof Landmark> = {
  bank_transfer: Landmark,
  cash_on_delivery: Banknote,
}

/** Every mark stands in a 24 px row; a wide wordmark shrinks to about the area of a square one (16–24 px tall). */
const ROW = 24
const AREA = 1500

function logoStyle({ width, height }: { width: number; height: number }): CSSProperties {
  const tall = Math.sqrt(AREA / (width / height))
  return { height: `${Math.min(ROW, Math.max(16, Math.round(tall)))}px` }
}

/** One mark, the provider's own on the well (no chip), never a link. */
function Mark({ mark }: { mark: ShopMarkView }) {
  const Icon = ICONS[mark.key]
  return (
    <li className="flex h-6 items-center gap-1.5 text-xs font-semibold text-text-2">
      {mark.logo ? (
        <img
          src={mark.logo.src}
          alt={mark.label}
          width={mark.logo.width}
          height={mark.logo.height}
          loading="lazy"
          decoding="async"
          className="w-auto"
          style={logoStyle(mark.logo)}
        />
      ) : (
        <>
          {Icon && <Icon className="size-4" aria-hidden="true" strokeWidth={2} />}
          {mark.label}
        </>
      )}
    </li>
  )
}

function Marks({ marks, label }: { marks: readonly ShopMarkView[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-x-6 gap-y-4">
      {marks.map((mark) => (
        <Mark key={mark.key} mark={mark} />
      ))}
    </ul>
  )
}

/**
 * The footer's trust band (sahip 2026-11-06): the ways to pay and the
 * carriers the shop has now in one quiet row, every mark the provider's
 * own (served by the storefront) straight on the well, one 24 px row
 * with wide wordmarks shrunk to the area of a square one, a hairline
 * between the two groups; a bank transfer or cash at the door as an icon
 * and its name. On a phone and a tablet the two groups are two wrapping
 * rows. The ETBİS registration's QR code at the end on its own light
 * plate (a code needs its quiet zone). Each only when the shop has it;
 * with none, nothing is drawn.
 */
export function FooterMarks({ shop, t }: { shop: ShopView; t: Translate }) {
  const payments = shop.paymentMarks ?? []
  const carriers = shop.carrierMarks ?? []
  const qr = shop.etbisQr ?? null
  if (!qr && payments.length === 0 && carriers.length === 0) {
    return null
  }
  return (
    <div className="flex items-center justify-between gap-6 border-b border-rule py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        {payments.length > 0 && <Marks marks={payments} label={t("footer.payment_marks")} />}
        {payments.length > 0 && carriers.length > 0 && (
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-rule max-lg:hidden" />
        )}
        {carriers.length > 0 && <Marks marks={carriers} label={t("footer.carrier_marks")} />}
      </div>
      {qr && (
        <span className="block size-16 shrink-0 rounded-inner border border-rule bg-chip p-1">
          <ResponsiveImage
            image={{ ...qr, alt: t("footer.etbis_qr_alt") }}
            sizes="64px"
            className="h-full w-full object-contain"
          />
        </span>
      )}
    </div>
  )
}
