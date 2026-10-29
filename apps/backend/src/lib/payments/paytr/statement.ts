import { z } from "@medusajs/framework/zod"
import type { HttpClient } from "../../clients"
import { ProviderError } from "../../errors"
import type { StatementRow } from "../statements"
import { PAYTR_PROVIDER, paytrError } from "./errors"
import { lira, text } from "./schemas"
import { statementHash } from "./signatures"
import type { PaytrCredentials } from "./types"

/**
 * PayTR's İşlem Dökümü (dev.paytr.com/islem-dokumu, 2026-10-29): sales
 * (`S`) and refunds (`I`) between two moments, three days at most. The
 * page lists a row's fields but not what holds the rows, and the official
 * samples print the answer whole: every array or object in the answer
 * that carries a row's fields is read as rows, each one strictly. A range
 * without a transaction is `failed`.
 */

export const STATEMENT_PATH = "/rapor/islem-dokumu"

// "13.01.2021" as documented; a time after it is allowed
const DAY = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/

const row = z.object({
  islem_tipi: z.enum(["S", "I"]),
  islem_tutari: lira,
  odeme_tutari: z.union([lira, z.literal(""), z.null()]).optional(),
  islem_tarihi: z
    .string()
    .regex(DAY)
    .transform((value) => value.replace(DAY, "$3-$2-$1")),
  siparis_no: text.pipe(z.string().min(1).max(64)),
})

const answer = z.looseObject({
  status: z.enum(["success", "failed", "error"]),
  err_no: text.optional(),
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const looksLikeRow = (value: unknown) =>
  isRecord(value) && ("islem_tipi" in value || "siparis_no" in value)

/** The rows wherever the answer keeps them: under a key as a list, or one per key. */
export function statementRowsIn(body: Record<string, unknown>): unknown[] {
  return Object.values(body).flatMap((value) => {
    if (Array.isArray(value)) {
      return (value as unknown[]).filter(looksLikeRow)
    }
    return looksLikeRow(value) ? [value] : []
  })
}

/** Reads one answer into rows; one row PayTR was not documented to send fails it whole. */
export function readPaytrStatement(body: z.infer<typeof answer>): StatementRow[] {
  if (body.status === "failed") {
    return []
  }
  if (body.status === "error") {
    throw paytrError("statement", body.err_no)
  }
  const rows = z.array(row).safeParse(statementRowsIn(body))
  if (!rows.success) {
    throw new ProviderError({
      provider: PAYTR_PROVIDER,
      providerCode: "invalid_response",
      retryable: false,
      cause: rows.error,
    })
  }
  return rows.data.map((entry) => ({
    kind: entry.islem_tipi === "S" ? "sale" : "refund",
    reference: entry.siparis_no,
    amount: entry.islem_tutari,
    alternative: typeof entry.odeme_tutari === "number" ? entry.odeme_tutari : null,
    day: entry.islem_tarihi,
  }))
}

/** The statement call over its own client (a slow report must not trip the payments' breaker). */
export function statementCall(http: HttpClient) {
  /** Sales and refunds from the start of `from` to the end of `to`, Turkish `YYYY-MM-DD` days. */
  return async function statement(
    credentials: PaytrCredentials,
    from: string,
    to: string
  ): Promise<StatementRow[]> {
    const startDate = `${from} 00:00:00`
    const endDate = `${to} 23:59:59`
    const body = await http.request({
      method: "POST",
      path: STATEMENT_PATH,
      form: {
        merchant_id: credentials.merchantId,
        start_date: startDate,
        end_date: endDate,
        paytr_token: statementHash(credentials, startDate, endDate),
      },
      // A read: safe to send again
      idempotent: true,
      schema: answer,
    })
    return readPaytrStatement(body)
  }
}
