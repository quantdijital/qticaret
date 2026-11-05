import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopMarkView, ShopView, Translate } from "@qticaret/ui"

function Group({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-sm text-stage-text-2">{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Badges({ marks }: { marks: readonly ShopMarkView[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {marks.map((mark) => (
        <li
          key={mark.key}
          className="rounded-inner bg-stage-2 px-3 py-1.5 text-sm font-semibold text-stage-text"
        >
          {mark.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * The footer's marks, each under its own name: the ways to pay and the
 * carriers the shop has now as rounded text plates (no provider's logo
 * ships with the platform), and the ETBİS registration's QR code on a
 * light plate (a code needs its quiet zone). Each only when the shop has
 * it; with none, nothing is drawn.
 */
export function FooterMarks({ shop, t }: { shop: ShopView; t: Translate }) {
  const payments = shop.paymentMarks ?? []
  const carriers = shop.carrierMarks ?? []
  const qr = shop.etbisQr ?? null
  if (!qr && payments.length === 0 && carriers.length === 0) {
    return null
  }
  return (
    <dl className="flex flex-wrap items-start gap-x-(--space-xl) gap-y-6">
      {payments.length > 0 && (
        <Group term={t("footer.payment_marks")}>
          <Badges marks={payments} />
        </Group>
      )}
      {carriers.length > 0 && (
        <Group term={t("footer.carrier_marks")}>
          <Badges marks={carriers} />
        </Group>
      )}
      {qr && (
        <Group term={t("footer.etbis_qr_alt")}>
          <span className="block size-22 rounded-inner bg-stage-text p-1.5">
            <ResponsiveImage
              image={{ ...qr, alt: "" }}
              sizes="88px"
              className="h-full w-full object-contain"
            />
          </span>
        </Group>
      )}
    </dl>
  )
}
