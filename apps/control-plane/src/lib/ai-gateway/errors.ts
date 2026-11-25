import { AI_CALL_RESPONSE_HEADERS, AI_GATEWAY_REFUSALS } from "@qticaret/types/control-plane"
import type { AiGatewayRefusalCode } from "@qticaret/types/control-plane"

/**
 * What the gateway answers a call (adr/0085 §2). A provider's answer
 * passes with its status, its type and its bytes, plus the credits this
 * call charged and the wallet left. The gateway's own refusal is told
 * apart by `x-qt-ai-refusal` and its envelope `{ qt_ai_gateway: { code } }`,
 * with the code's own status, so a shop never takes it for a provider's
 * 4xx. No answer carries a provider's headers, nor its words on a refused
 * key (a 401 or 403 body may quote part of the key: it becomes
 * `unavailable`).
 */

export interface GatewayAnswer {
  status: number
  headers: Record<string, string>
  body: Buffer
}

/** The credits charged by this call and the wallet left, for the answer's headers. */
export interface CreditNote {
  charged: number
  balance: number
}

const creditHeaders = (note: CreditNote | null): Record<string, string> =>
  note === null
    ? {}
    : {
        [AI_CALL_RESPONSE_HEADERS.charged]: String(Math.max(0, note.charged)),
        [AI_CALL_RESPONSE_HEADERS.balance]: String(Math.max(0, note.balance)),
      }

/** The gateway's refusal: its code's status, the marker header, the envelope. */
export function refusal(code: AiGatewayRefusalCode, note: CreditNote | null = null): GatewayAnswer {
  return {
    status: AI_GATEWAY_REFUSALS[code],
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      [AI_CALL_RESPONSE_HEADERS.refusal]: code,
      ...creditHeaders(note),
    },
    body: Buffer.from(JSON.stringify({ qt_ai_gateway: { code } })),
  }
}

/** A provider's answer as it came: status, type, bytes; our credit headers beside them. */
export function passedOn(
  answer: { status: number; contentType: string; body: Buffer },
  note: CreditNote
): GatewayAnswer {
  return {
    status: answer.status,
    headers: {
      "content-type": answer.contentType,
      "cache-control": "no-store",
      ...creditHeaders(note),
    },
    body: answer.body,
  }
}

/** Whether an answer may hold the key's words: a refused key's, or one that has it in full. */
export function mayEchoKey(status: number, body: Buffer, key: Buffer): boolean {
  return status === 401 || status === 403 || (key.length > 0 && body.includes(key))
}
