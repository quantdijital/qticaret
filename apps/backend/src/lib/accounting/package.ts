import { fromMedusaAmount, toMedusaAmount } from "../money"
import type { MedusaAmount } from "../money"
import { methodOf, vatBreakdown } from "../reports/finance"
import type { FinanceOrder } from "../reports/finance"
import type { SheetCell } from "../sheets"
import { GIFT_CARD_MOVES, giftCardTotals } from "./gift-cards"
import type { GiftCardMove } from "./gift-cards"

/**
 * The month's standard package for the accountant (F11.5, adr/0039 §5):
 * sales by order and VAT rate, refunds, collections, the VAT summary and
 * gift cards sold (an advance, out of the sales) and spent, as sheets. Personal data kept to the least: an individual's name is not
 * in it; a corporate customer's registered name, tax office and tax id
 * (VKN) are, as the accountant keeps them for the invoice anyway. Pure.
 */

export const PACKAGE_TABLES = ["sales", "returns", "collections", "vat", "gift_cards"] as const
export type PackageTable = (typeof PACKAGE_TABLES)[number]

export interface PackageOrder extends FinanceOrder {
  display_id: number
  created_at: string | Date
  customer_id: string | null
}

/** Who an order's invoice is for. */
export type Party =
  | { kind: "individual" }
  | { kind: "corporate"; name: string; tax_office: string | null; tax_id: string }

/** Money taken or given back on an order, on a day. */
export interface PackageMove {
  order_display_id: number | null
  day: string
  provider_id: string
  amount: MedusaAmount
}

const METHODS: Readonly<Record<string, string>> = {
  paytr: "PayTR",
  iyzico: "iyzico",
  "bank-transfer": "Havale/EFT",
  cod: "Kapıda ödeme",
  "gift-card": "Hediye kartı",
  system: "Sistem (deneme)",
}

/** Lira as a sheet number, from a Medusa amount (exact to the kuruş). */
const lira = (amount: MedusaAmount): number =>
  fromMedusaAmount(amount, { allowRounding: true }) / 100

const methodName = (providerId: string) => {
  const method = methodOf(providerId)
  return METHODS[method] ?? method
}

const orderNo = (display: number | null) => (display === null ? "" : `#${String(display)}`)

/**
 * The package's tables. `orders` come without their gift card lines, whose
 * money is in `giftCards` (`giftCardSplit`): no sale, no KDV of the month.
 */
export function packageTables(input: {
  orders: readonly PackageOrder[]
  parties: ReadonlyMap<string, Party>
  captures: readonly PackageMove[]
  refunds: readonly PackageMove[]
  giftCards?: readonly GiftCardMove[]
  dayOf: (at: string | Date) => string
}): Record<PackageTable, SheetCell[][]> {
  const giftCards = input.giftCards ?? []
  const giftTotals = giftCardTotals(giftCards)
  const partyOf = (order: PackageOrder): Party =>
    (order.customer_id ? input.parties.get(order.customer_id) : undefined) ?? {
      kind: "individual",
    }
  const moves = (rows: readonly PackageMove[]) =>
    [...rows]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((move) => [
        orderNo(move.order_display_id),
        move.day,
        methodName(move.provider_id),
        lira(move.amount),
      ])
  return {
    sales: [
      [
        "Sipariş",
        "Tarih",
        "Müşteri türü",
        "Unvan",
        "Vergi dairesi",
        "VKN",
        "KDV oranı (%)",
        "Matrah (TL)",
        "KDV (TL)",
        "Toplam (TL)",
      ],
      ...input.orders.flatMap((order) => {
        const party = partyOf(order)
        const who: SheetCell[] =
          party.kind === "corporate"
            ? ["Kurumsal", party.name, party.tax_office ?? "", party.tax_id]
            : ["Bireysel", "", "", ""]
        return vatBreakdown([order]).map((row) => [
          orderNo(order.display_id),
          input.dayOf(order.created_at),
          ...who,
          row.rate,
          lira(row.base),
          lira(row.tax),
          lira(row.gross),
        ])
      }),
    ],
    returns: [["Sipariş", "Tarih", "Ödeme yöntemi", "İade (TL)"], ...moves(input.refunds)],
    collections: [
      ["Sipariş", "Tarih", "Ödeme yöntemi", "Tahsilat (TL)", "Komisyon (TL)"],
      // The provider's commission is not known here: left for the accountant
      ...moves(input.captures).map((row) => [...row, null]),
    ],
    vat: [
      ["KDV oranı (%)", "Matrah (TL)", "KDV (TL)", "Toplam (TL)"],
      ...vatBreakdown(input.orders).map((row) => [
        row.rate,
        lira(row.base),
        lira(row.tax),
        lira(row.gross),
      ]),
    ],
    gift_cards: [
      ["Hareket", "Sipariş", "Tarih", "Tutar (TL)"],
      ...[...giftCards]
        .sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind))
        .map((move) => [
          GIFT_CARD_MOVES[move.kind],
          orderNo(move.order_display_id),
          move.day,
          lira(toMedusaAmount(move.amount)),
        ]),
      // The month's amounts, each always written
      [GIFT_CARD_MOVES.sold, "Ay toplamı", "", lira(toMedusaAmount(giftTotals.sold))],
      [GIFT_CARD_MOVES.spent, "Ay toplamı", "", lira(toMedusaAmount(giftTotals.spent))],
    ],
  }
}

export const PACKAGE_SHEETS: Record<
  PackageTable,
  { name: string; file: string; widths: number[] }
> = {
  sales: { name: "Satışlar", file: "satislar", widths: [12, 12, 14, 32, 18, 14, 12, 14, 12, 14] },
  returns: { name: "İadeler", file: "iadeler", widths: [12, 12, 18, 14] },
  collections: { name: "Tahsilatlar", file: "tahsilatlar", widths: [12, 12, 18, 14, 14] },
  vat: { name: "KDV özeti", file: "kdv-ozeti", widths: [14, 16, 14, 16] },
  gift_cards: { name: "Hediye kartları", file: "hediye-kartlari", widths: [30, 12, 12, 14] },
}
