import type { FakePayment, FakeRefundEntry, Fields, Reply } from "./handlers"
import { paytrSign } from "./signing"
import type { PaytrAccount } from "./signing"

/**
 * The fake PayTR's İşlem Dökümü (dev.paytr.com/islem-dokumu, 2026-10-29):
 * the paid payments and refunds between two Turkish moments, three days
 * at most; `failed` when there are none. Which key holds the rows is not
 * documented: this fake keeps them under their numbers, as PHP writes a
 * list with `status` added to it (the backend reads either shape).
 */

const MOMENT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
const TURKEY_MS = 3 * 60 * 60 * 1000
const MAX_RANGE_MS = 3 * 24 * 60 * 60 * 1000

const instant = (text: string): number | null => {
  const match = MOMENT.exec(text)
  if (!match) {
    return null
  }
  const [, year, month, day, hour, minute, second] = match.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  return Date.UTC(year, month - 1, day, hour, minute, second) - TURKEY_MS
}

/** "13.01.2021": the day as the statement writes it. */
const dottedDay = (at: number): string => {
  const iso = new Date(at + TURKEY_MS).toISOString()
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

const dotLira = (kurus: number): string =>
  `${String(Math.floor(kurus / 100))}.${String(kurus % 100).padStart(2, "0")}`

const error = (errNo: string, message: string): Reply => ({
  body: { status: "error", err_no: errNo, err_msg: message },
})

export function fakeStatement(
  account: PaytrAccount,
  payments: Map<string, FakePayment>,
  refundLog: readonly FakeRefundEntry[]
) {
  return (fields: Fields): Reply => {
    const start = fields["start_date"] ?? ""
    const end = fields["end_date"] ?? ""
    if (fields["merchant_id"] !== account.merchantId) {
      return error("001", "Gecersiz istek veya magaza aktif degil")
    }
    if (fields["paytr_token"] !== paytrSign(account, [account.merchantId, start, end])) {
      return error("003", "paytr_token gonderilmedi veya gecersiz")
    }
    const from = instant(start)
    const to = instant(end)
    if (from === null || to === null || to < from || to - from > MAX_RANGE_MS) {
      return error("002", "start_date veya end_date gecersiz")
    }
    const within = (at: number | undefined) => at !== undefined && at >= from && at <= to
    const row = (kind: "S" | "I", payment: FakePayment, amount: number, at: number) => ({
      islem_tipi: kind,
      net_tutar: dotLira(amount),
      kesinti_tutari: "0.00",
      kesinti_orani: "0",
      islem_tutari: dotLira(amount),
      odeme_tutari: dotLira(kind === "S" ? payment.totalAmount : amount),
      islem_tarihi: dottedDay(at),
      para_birimi: payment.currency,
      taksit: String(payment.installments),
      kart_marka: "BONUS",
      kart_no: "455359AAA6747",
      siparis_no: payment.merchantOid,
      odeme_tipi: "KART",
    })
    const sales = [...payments.values()]
      .filter((payment) => payment.status === "success" && within(payment.paidAt))
      .map((payment) => row("S", payment, payment.paymentAmount, payment.paidAt ?? 0))
    const refunds = refundLog.flatMap((refund) => {
      const payment = payments.get(refund.merchantOid)
      return payment && within(refund.at) ? [row("I", payment, refund.amount, refund.at)] : []
    })
    const rows = [...sales, ...refunds]
    if (rows.length === 0) {
      return { body: { status: "failed" } }
    }
    return {
      body: {
        status: "success",
        ...Object.fromEntries(rows.map((entry, i) => [String(i), entry])),
      },
    }
  }
}
