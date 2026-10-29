import type { FakeCheckoutForm } from "./checkout-form"
import type { GivenBack } from "./refunds"

/**
 * The fake iyzico's daily transactions report (docs.iyzico.com "Reporting
 * Service", 2026-10-29): `GET /v2/reporting/payment/transactions` with
 * `transactionDate` and `page`, a day as Turkey counts it. Pages are short
 * here so that a client must read them all.
 */

export const STATEMENT_PAGE_SIZE = 5

const TURKEY_MS = 3 * 60 * 60 * 1000
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** "2026-10-29 14:05:09", Turkish time. */
const moment = (at: number): string =>
  new Date(at + TURKEY_MS).toISOString().slice(0, 19).replace("T", " ")

interface Reply {
  status?: number
  body: unknown
}

export function createStatement(forms: Map<string, FakeCheckoutForm>, log: readonly GivenBack[]) {
  const row = (
    type: "PAYMENT" | "REFUND" | "CANCEL",
    form: FakeCheckoutForm,
    price: number,
    at: number,
    paidPrice: number = price
  ) => ({
    transactionType: type,
    transactionDate: moment(at),
    transactionId: `${form.result?.paymentId ?? ""}${String(at).slice(-6)}`,
    paymentId: Number(form.result?.paymentId),
    conversationId: form.conversationId,
    basketId: form.basketId,
    transactionStatus: 1,
    price,
    paidPrice,
    transactionCurrency: form.currency,
    installment: form.result?.installment ?? 1,
    afterSettlement: 0,
  })

  return (query: URLSearchParams): Reply => {
    const day = query.get("transactionDate") ?? ""
    const page = Number(query.get("page"))
    if (!DAY.test(day) || !Number.isInteger(page) || page < 1) {
      return {
        body: {
          status: "failure",
          errorCode: "FAKE_INVALID_QUERY",
          errorMessage: "transactionDate ve page zorunlu",
          locale: "tr",
          systemTime: Date.now(),
        },
      }
    }
    const onDay = (at: number) => moment(at).startsWith(day)
    const rows = [
      ...[...forms.values()]
        .filter((form) => form.result?.paymentStatus === "SUCCESS" && onDay(form.result.paidAt))
        .map((form) =>
          row(
            "PAYMENT",
            form,
            Number(form.price),
            form.result?.paidAt ?? 0,
            Number(form.result?.paidPrice)
          )
        ),
      ...log
        .filter((entry) => onDay(entry.at))
        .map((entry) => row(entry.kind, entry.form, entry.amount / 100, entry.at)),
    ]
    const pages = Math.max(1, Math.ceil(rows.length / STATEMENT_PAGE_SIZE))
    return {
      body: {
        status: "success",
        locale: "tr",
        systemTime: Date.now(),
        transactions: rows.slice((page - 1) * STATEMENT_PAGE_SIZE, page * STATEMENT_PAGE_SIZE),
        currentPage: page,
        totalPageCount: pages,
      },
    }
  }
}
