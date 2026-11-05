import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopMarkView, ShopView, Translate } from "@qticaret/ui"

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    // From 640 px the terms share one column, so every row's marks start on one line
    <div className="flex flex-col gap-2 sm:contents">
      <dt className="sm:self-center">{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Badges({ marks }: { marks: readonly ShopMarkView[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {marks.map((mark) => (
        <li key={mark.key} className="border border-band-rule px-2 py-1 text-band-text">
          {mark.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * The small print's marks (design.md § Footer; adr/0046 Ek 2026-11-04),
 * each under its own name: the ETBİS registration's QR code on a light
 * square (a code needs its quiet zone, on dark paper too), the ways to
 * pay and the carriers the shop has now as square text badges; no
 * provider's logo is shipped. Each only when the shop has it; with none,
 * nothing is drawn.
 */
export function FooterMarks({ shop, t }: { shop: ShopView; t: Translate }) {
  const payments = shop.paymentMarks ?? []
  const carriers = shop.carrierMarks ?? []
  const qr = shop.etbisQr ?? null
  if (!qr && payments.length === 0 && carriers.length === 0) {
    return null
  }
  return (
    <dl className="flex flex-col gap-3 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
      {qr && (
        <Row term={t("footer.etbis_qr_alt")}>
          <span className="block size-20 bg-band-text p-1">
            {/* Its name is the term beside it */}
            <ResponsiveImage
              image={{ ...qr, alt: "" }}
              sizes="80px"
              className="h-full w-full object-contain"
            />
          </span>
        </Row>
      )}
      {payments.length > 0 && (
        <Row term={t("footer.payment_marks")}>
          <Badges marks={payments} />
        </Row>
      )}
      {carriers.length > 0 && (
        <Row term={t("footer.carrier_marks")}>
          <Badges marks={carriers} />
        </Row>
      )}
    </dl>
  )
}
