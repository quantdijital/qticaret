import { formatLira } from "@qticaret/ui"
import type {
  PaymentLinkLineView,
  PaymentLinkOrderView,
  PaymentLinkPageView,
  Translate,
} from "@qticaret/ui"
import type { StorePaymentLink, StorePaymentLinkLine } from "@qticaret/types"

/**
 * `/ode/<token>` (adr/0051): a payment link staff sent. Opening it changes
 * nothing (a mail scanner may open it); "Ödemeye geç" turns it into the
 * shopper's cart. The token is the page's own address and its form's
 * hidden field, nothing more: no tag hears it (`lib/analytics`), no log.
 */

export const PAYMENT_LINK_ROOT = "/ode"

// The backend's shape (`PAYMENT_LINK_TOKEN_SHAPE`): `pl_<22>.<end>.<mac>`; anything else is asked nothing
const TOKEN = /^pl_[0-9A-Za-z_-]{22}\.[0-9a-z]{1,12}\.[\w-]{43}$/

/** The token when it has the shape of one; anything else is no link. */
export const paymentLinkTokenOf = (value: unknown): string | null =>
  typeof value === "string" && TOKEN.test(value) ? value : null

/** What "Ödemeye geç" can come back with when it does not go on to checkout. */
export type PaymentLinkOutcome =
  "prices_changed" | "out_of_stock" | "unavailable" | "busy" | "failed"

/** How the outcome reads in the address (`?durum=`): Turkish words, as the paths. */
export const PAYMENT_LINK_OUTCOMES: Readonly<Record<PaymentLinkOutcome, string>> = {
  prices_changed: "fiyat",
  out_of_stock: "stok",
  unavailable: "yok",
  busy: "yogun",
  failed: "hata",
}

export const paymentLinkOutcomeOf = (value: unknown): PaymentLinkOutcome | null =>
  (Object.keys(PAYMENT_LINK_OUTCOMES) as PaymentLinkOutcome[]).find(
    (outcome) => PAYMENT_LINK_OUTCOMES[outcome] === value
  ) ?? null

/** The link's page, with what the button came back with. */
export const paymentLinkPath = (token: string, outcome?: PaymentLinkOutcome): string =>
  `${PAYMENT_LINK_ROOT}/${token}${outcome ? `?durum=${PAYMENT_LINK_OUTCOMES[outcome]}` : ""}`

const WHEN = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

/** Kuruş in words: "1.250,00 TL". */
const lira = (kurus: number): string => formatLira(kurus / 100)

const whenOf = (iso: string): string => {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? WHEN.format(new Date(at)) : ""
}

const lineOf = (line: StorePaymentLinkLine): PaymentLinkLineView => ({
  title: line.title,
  detail: line.variant_title,
  quantity: line.quantity,
  unitPrice: lira(line.unit_price),
  total: lira(line.total),
  image: line.thumbnail
    ? {
        src: line.thumbnail,
        alt: line.title,
        width: null,
        height: null,
        sources: { avif: null, webp: null },
      }
    : null,
  inStock: line.in_stock,
})

const nameOf = (name: string | null): string | null => {
  const trimmed = name?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

/** The link's order in words; the links are in lira (adr/0051: a TRY region only). */
export const paymentLinkOrderOf = (link: StorePaymentLink): PaymentLinkOrderView => ({
  number: link.number,
  firstName: nameOf(link.first_name),
  lines: link.lines.map(lineOf),
  items: lira(link.items_total),
  discount: link.discount_total > 0 ? lira(link.discount_total) : null,
  total: lira(link.total),
  shippingPreset: link.shipping.preset,
  expires: whenOf(link.expires_at),
})

const NOTICES: Readonly<Record<PaymentLinkOutcome, string | null>> = {
  prices_changed: "payment_link.prices_changed",
  out_of_stock: "payment_link.out_of_stock",
  unavailable: null,
  busy: "payment_link.busy",
  failed: "payment_link.failed",
}

/**
 * The page for a link: nothing to show for one that opens nothing (one
 * wording whatever the reason); prices that moved explained, with no
 * button; after the button, its answer, with the button again only where
 * pressing later can help (busy, a failure on our side). Never retried
 * by itself.
 */
export function paymentLinkView(
  link: StorePaymentLink | null,
  input: { token: string; outcome: PaymentLinkOutcome | null; replacesCart: boolean },
  t: Translate
): PaymentLinkPageView {
  if (!link || input.outcome === "unavailable") {
    return { order: null, notice: null, pay: null }
  }
  const moved = link.state === "prices_changed" || input.outcome === "prices_changed"
  const notice = moved ? NOTICES.prices_changed : input.outcome ? NOTICES[input.outcome] : null
  const closed = moved || input.outcome === "out_of_stock"
  return {
    order: paymentLinkOrderOf(link),
    notice: notice ? t(notice) : null,
    pay: closed
      ? null
      : {
          fields: [{ name: "token", value: input.token }],
          warning: input.replacesCart ? t("payment_link.replaces_cart") : null,
        },
  }
}
