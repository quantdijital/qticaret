import type { TransportResponse } from "./transport"
import { findFirst, parseXml, textOf } from "./xml"
import type { XmlNode } from "./xml"

/**
 * A SOAP service's refusal sent as an HTTP 5xx (adr/0035). SOAP 1.1 sends
 * every fault as a 500, so a fault in the body is the service's own answer:
 * the call was refused, not lost. Read with the safe XML reader (no DTD,
 * depth and element limits) and only from an XML answer, which the client
 * has already held to its size limit.
 */

const XML_TYPE = /^(?:text\/xml|application\/soap\+xml)\s*(?:;|$)/i

// A JAX-WS service exception names its code and its sentence in the detail
// (`errorCode`, `errText`: Yurtiçi)
const DETAIL_CODE = "errorCode"
const DETAIL_TEXT = "errText"

const localName = (code: string): string => code.slice(code.lastIndexOf(":") + 1).trim()

export interface SoapFault {
  /**
   * The fault's code, its detail's own code first, else the fault code's
   * local name (`soap:Server` → `Server`, SOAP 1.2's `env:Receiver` →
   * `Receiver`); `""` for a fault naming none.
   */
  code: string
  /**
   * The service's own sentence: the detail's `errText`, else SOAP 1.1's
   * `faultstring` or SOAP 1.2's `Reason/Text`. As sent: it is made safe
   * (`providerText`) before anyone reads it.
   */
  text: string | undefined
}

/** A fault's code and sentence, from an answer already read (a fault under HTTP 200 too). */
export function readSoapFault(fault: XmlNode): SoapFault {
  const text =
    textOf(fault, DETAIL_TEXT) ??
    textOf(fault, "faultstring") ??
    textOf(findFirst(fault, "Reason") ?? fault, "Text") ??
    undefined
  const detail = textOf(fault, DETAIL_CODE)
  if (detail) {
    return { code: detail, text }
  }
  // SOAP 1.1 `faultcode`; SOAP 1.2 `Code/Value`
  const code =
    findFirst(fault, "faultcode") ?? findFirst(findFirst(fault, "Code") ?? fault, "Value")
  return { code: localName(code?.text ?? ""), text }
}

/**
 * The fault in a 5xx answer. Undefined when the answer is not XML or
 * holds no fault: then the outcome stays unknown.
 */
export function soapFaultOf(response: TransportResponse): SoapFault | undefined {
  if (!XML_TYPE.test((response.header("content-type") ?? "").trim())) {
    return undefined
  }
  let fault
  try {
    fault = findFirst(parseXml(response.text), "Fault")
  } catch {
    return undefined
  }
  return fault ? readSoapFault(fault) : undefined
}
