import { z } from "@medusajs/framework/zod"
import { ProviderError } from "../../errors"
import type { StatementRow } from "../statements"
import { iyzicoPrice, parseIyzicoPrice } from "./amounts"
import { IYZICO_PROVIDER } from "./errors"
import type { IyzicoCredentials } from "./types"

/**
 * iyzico's daily transactions report (docs.iyzico.com "Reporting
 * Service", 2026-10-29): `GET /v2/reporting/payment/transactions` with
 * `transactionDate` (`YYYY-MM-DD`) and `page` from 1; the answer has
 * `transactions`, `currentPage` and `totalPageCount`. A GET is signed over
 * its path alone, without the query (iyzipay-php `IyziAuthV2Generator`).
 * A payment iyzico rejected after review (`transactionStatus` -1) took no
 * money; a cancel gives the payment back whole.
 */

export const STATEMENT_PATH = "/v2/reporting/payment/transactions"

// A runaway answer (a page count that never ends) stops here
const MAX_PAGES = 200

const transaction = z.looseObject({
  transactionType: z.enum(["PAYMENT", "REFUND", "CANCEL"]),
  transactionStatus: z.union([z.number(), z.string()]).transform(Number).optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  // Kept in the check's issues and shown to staff: a reference, never longer
  paymentId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(64)),
  price: iyzicoPrice,
})

export const statementAnswer = z.object({
  transactions: z.array(transaction).default([]),
  currentPage: z.number().int().optional(),
  totalPageCount: z.number().int().min(0).default(1),
})

/** The client's signed GET (`client.ts`). */
export type IyzicoGet = <T>(
  credentials: IyzicoCredentials,
  path: string,
  query: Record<string, string>,
  schema: z.ZodType<T>
) => Promise<T>

const invalid = (cause: unknown) =>
  new ProviderError({
    provider: IYZICO_PROVIDER,
    providerCode: "invalid_response",
    retryable: false,
    cause,
  })

/** One page's rows, in kuruş. */
export function readIyzicoStatement(
  transactions: z.infer<typeof statementAnswer>["transactions"]
): StatementRow[] {
  return transactions
    .filter((entry) => !(entry.transactionType === "PAYMENT" && entry.transactionStatus === -1))
    .map((entry) => {
      let amount
      try {
        amount = parseIyzicoPrice(entry.price)
      } catch (error) {
        throw invalid(error)
      }
      return {
        kind: entry.transactionType === "PAYMENT" ? "sale" : "refund",
        reference: entry.paymentId,
        amount,
        day: entry.transactionDate.slice(0, 10),
      }
    })
}

export function statementCalls(get: IyzicoGet) {
  /** Every transaction iyzico booked on a day, page after page. */
  async function statement(credentials: IyzicoCredentials, day: string): Promise<StatementRow[]> {
    const rows: StatementRow[] = []
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const answer = await get(
        credentials,
        STATEMENT_PATH,
        { transactionDate: day, page: String(page), locale: "tr" },
        statementAnswer
      )
      rows.push(...readIyzicoStatement(answer.transactions))
      if (page >= answer.totalPageCount) {
        return rows
      }
    }
    throw invalid(new Error("the statement has more pages than are read"))
  }

  return { statement }
}
