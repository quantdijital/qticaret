import { Banknote, Landmark } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopMarkView, ShopView, Translate } from "@qticaret/ui"

/** Ways to pay with no company's mark: drawn as an icon beside their name. */
const ICONS: Record<string, typeof Landmark> = {
  bank_transfer: Landmark,
  cash_on_delivery: Banknote,
}

/** One mark on its light chip (light in the dark too, so a provider's colours read): never a link. */
function Chip({ mark }: { mark: ShopMarkView }) {
  const Icon = ICONS[mark.key]
  return (
    <li className="flex h-9 items-center gap-2 rounded-inner border border-rule bg-chip px-3 text-xs font-semibold text-stage">
      {mark.logo ? (
        <img
          src={mark.logo.src}
          alt={mark.label}
          width={mark.logo.width}
          height={mark.logo.height}
          loading="lazy"
          decoding="async"
          className="h-5 w-auto"
        />
      ) : (
        <>
          {Icon && <Icon className="size-4" aria-hidden="true" strokeWidth={1.75} />}
          {mark.label}
        </>
      )}
    </li>
  )
}

function Row({ term, marks }: { term: string; marks: readonly ShopMarkView[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <dt className="w-16 shrink-0 text-xs text-text-3">{term}</dt>
      <dd>
        <ul className="flex flex-wrap gap-2">
          {marks.map((mark) => (
            <Chip key={mark.key} mark={mark} />
          ))}
        </ul>
      </dd>
    </div>
  )
}

/**
 * The footer's marks: the ways to pay and the carriers the shop has now,
 * one row each under a quiet name, every mark the provider's own (served
 * by the storefront) on a light chip of one height, a bank transfer or
 * cash at the door as an icon and its name; and the ETBİS registration's
 * QR code on its own light plate (a code needs its quiet zone). Each only
 * when the shop has it; with none, nothing is drawn.
 */
export function FooterMarks({ shop, t }: { shop: ShopView; t: Translate }) {
  const payments = shop.paymentMarks ?? []
  const carriers = shop.carrierMarks ?? []
  const qr = shop.etbisQr ?? null
  if (!qr && payments.length === 0 && carriers.length === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      {(payments.length > 0 || carriers.length > 0) && (
        <dl className="flex flex-col gap-3">
          {payments.length > 0 && <Row term={t("footer.marks_payment")} marks={payments} />}
          {carriers.length > 0 && <Row term={t("footer.marks_carrier")} marks={carriers} />}
        </dl>
      )}
      {qr && (
        <span className="block size-20 shrink-0 rounded-inner border border-rule bg-chip p-1.5">
          <ResponsiveImage
            image={{ ...qr, alt: t("footer.etbis_qr_alt") }}
            sizes="80px"
            className="h-full w-full object-contain"
          />
        </span>
      )}
    </div>
  )
}
