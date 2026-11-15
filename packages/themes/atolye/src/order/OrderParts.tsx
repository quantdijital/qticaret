import { ExternalLink, HandCoins, Landmark, Truck } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { OrderPageView, Translate } from "@qticaret/ui"
import { LineAddons } from "../parts/LineAddons"
import { LineName, LinePhoto } from "../parts/LineLink"
import { CopyIban } from "./CopyIban"
import { OrderGift } from "./OrderGift"

const WELL = "flex flex-col gap-5 rounded-tile bg-paper-2 p-5 sm:p-7"

/** A transfer not paid yet: the account, the amount and the reference, the IBAN large with a button that copies it. */
export function BankTransfer({ view, t }: { view: OrderPageView; t: Translate }) {
  const bank = view.bankTransfer
  if (!bank) {
    return null
  }
  const facts: [string, string][] = [
    [t("order.bank_name"), bank.bankName],
    [t("order.bank_holder"), bank.accountHolder],
    [t("order.bank_amount"), bank.amount],
    [t("order.bank_reference"), `#${view.displayId}`],
  ]
  return (
    <section
      aria-labelledby="havale"
      className="flex flex-col gap-5 rounded-tile bg-highlight-soft p-5 sm:p-7"
    >
      <h2 id="havale" className="flex items-center gap-3 text-title">
        <Landmark className="size-6 shrink-0" aria-hidden="true" strokeWidth={1.75} />
        {t("order.bank_title")}
      </h2>
      <p className="text-md">
        {t("order.bank_text", { hours: bank.deadlineHours, id: view.displayId })}
      </p>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <dt className="text-sm text-text-2">IBAN</dt>
          <dd className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="tabular text-md font-extrabold tracking-[0.02em] break-words select-all sm:text-lg">
              {bank.iban}
            </span>
            <CopyIban
              iban={bank.iban}
              words={{
                copy: t("order.bank_copy"),
                label: t("order.bank_copy_iban"),
                copied: t("order.bank_copied"),
              }}
            />
          </dd>
        </div>
        {facts.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="text-sm text-text-2">{term}</dt>
            <dd className="tabular font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Cash on delivery: what is paid at the door. */
export function CashOnDelivery({ view, t }: { view: OrderPageView; t: Translate }) {
  if (!view.cashOnDelivery) {
    return null
  }
  return (
    <p className="flex items-start gap-3 rounded-tile bg-paper-2 p-5 text-md sm:p-7">
      <HandCoins className="size-6 shrink-0" aria-hidden="true" strokeWidth={1.75} />
      {t("order.cod_text", { amount: view.total })}
    </p>
  )
}

/** The parcels that left: carrier, where it is, its number and the carrier's own tracking page. */
export function Parcels({ view, t }: { view: OrderPageView; t: Translate }) {
  if (view.shipments.length === 0) {
    return null
  }
  return (
    <section aria-labelledby="kargo" className={WELL}>
      <h2 id="kargo" className="text-title">
        {t("order.shipments")}
      </h2>
      <ul className="flex flex-col gap-3">
        {view.shipments.map((parcel, index) => (
          <li
            key={String(index)}
            className="flex flex-col gap-3 rounded-media bg-field p-4 sm:flex-row sm:items-center"
          >
            <Truck className="size-6 shrink-0 text-text-2" aria-hidden="true" strokeWidth={1.75} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <span className="text-md font-semibold">
                {[parcel.carrier, parcel.status].filter(Boolean).join(", ")}
              </span>
              {parcel.trackingNumber && (
                <span className="tabular">
                  {t("order.tracking_number", { number: parcel.trackingNumber })}
                </span>
              )}
              <span className="text-text-2">{parcel.items}</span>
            </div>
            {parcel.trackingUrl && (
              <a
                href={parcel.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gf-btn gf-btn--quiet gf-btn--small shrink-0"
              >
                {t("order.track")}
                <ExternalLink className="size-4" aria-hidden="true" strokeWidth={2} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * What was bought: each line's photograph and name (a link to the
 * product's page while the shop still shows it), variant, count, picks and
 * total (beside it from 640 px, under the name on a phone).
 */
export function OrderLines({ view, t }: { view: OrderPageView; t: Translate }) {
  return (
    <section aria-labelledby="urunler" className={WELL}>
      <h2 id="urunler" className="text-title">
        {t("order.lines")}
      </h2>
      <ul className="flex flex-col gap-4">
        {view.lines.map((line, index) => (
          <li key={`${String(index)}:${line.title}`} className="flex items-start gap-4">
            <LinePhoto
              path={line.path}
              className="size-18 shrink-0 overflow-hidden rounded-inner bg-media-deep sm:size-20"
            >
              {line.image && (
                <ResponsiveImage
                  image={{ ...line.image, alt: "" }}
                  sizes="80px"
                  className="h-full w-full object-cover"
                />
              )}
            </LinePhoto>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <span className="text-md leading-snug font-semibold">
                <LineName path={line.path} title={line.title} />
              </span>
              {line.detail && line.detail.trim() !== line.title.trim() && (
                <span className="text-text-2">{line.detail}</span>
              )}
              <span className="tabular text-text-2">
                {t("order.quantity", { count: line.quantity })}
              </span>
              {line.gift && <OrderGift gift={line.gift} t={t} />}
              <LineAddons
                addons={line.addons}
                note={line.nonWithdrawable ? t("addons.line_non_withdrawable") : null}
                className="mt-1"
              />
              {/* On a phone the total stands under the name: a long name keeps the line's width */}
              <span className="tabular mt-1 text-md font-extrabold sm:hidden">{line.total}</span>
            </div>
            <span className="tabular shrink-0 text-md font-extrabold max-sm:hidden">
              {line.total}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
