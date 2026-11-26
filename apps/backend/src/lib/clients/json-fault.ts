import type { HttpClientOptions } from "./http-types"
import { parseJsonBody } from "./request"

/**
 * A JSON service's own refusal in an error body (`jsonFault`), the way a
 * SOAP fault is one (`soap-fault.ts`): its code, held to a provider's word
 * (`code`), and its sentence, made safe later (`providerText`). Undefined
 * when the body is no JSON or names no code.
 */
export function jsonFaultOf(
  text: string,
  read: NonNullable<HttpClientOptions["jsonFault"]>,
  code: RegExp
): { code: string; text: string | null } | undefined {
  const body = parseJsonBody(text)
  const fault = body === "invalid" ? undefined : read(body.value)
  return fault && code.test(`error_${fault.code}`) ? fault : undefined
}
