import type { TransportResponse } from "./transport"
import { findFirst, parseXml } from "./xml"

/**
 * A SOAP service's refusal sent as an HTTP 5xx (adr/0035). SOAP 1.1 sends
 * every fault as a 500, so a fault in the body is the service's own answer:
 * the call was refused, not lost. Read with the safe XML reader (no DTD,
 * depth and element limits) and only from an XML answer, which the client
 * has already held to its size limit.
 */

const XML_TYPE = /^(?:text\/xml|application\/soap\+xml)\s*(?:;|$)/i

// A JAX-WS service exception names its code in the detail (`errorCode`, Yurtiçi)
const DETAIL_CODE = "errorCode"

const localName = (code: string): string => code.slice(code.lastIndexOf(":") + 1).trim()

/**
 * The fault's code, its detail's own code first, else the fault code's
 * local name (`soap:Server` → `Server`, SOAP 1.2's `env:Receiver` →
 * `Receiver`); `""` for a fault naming none. Undefined when the answer is
 * not XML or holds no fault: then the outcome stays unknown.
 */
export function soapFaultOf(response: TransportResponse): string | undefined {
  if (!XML_TYPE.test((response.header("content-type") ?? "").trim())) {
    return undefined
  }
  let fault
  try {
    fault = findFirst(parseXml(response.text), "Fault")
  } catch {
    return undefined
  }
  if (!fault) {
    return undefined
  }
  const detail = findFirst(fault, DETAIL_CODE)?.text.trim()
  if (detail) {
    return detail
  }
  // SOAP 1.1 `faultcode`; SOAP 1.2 `Code/Value`
  const code =
    findFirst(fault, "faultcode") ?? findFirst(findFirst(fault, "Code") ?? fault, "Value")
  return localName(code?.text ?? "")
}
