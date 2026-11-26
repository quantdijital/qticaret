/**
 * The SOAP the fake PTT writes (docs/entegrasyonlar/ptt.md): envelopes,
 * answers as Axis2 writes them, faults, and PTT's check digit.
 */

/** PTT's check digit (weights 1 and 3 from the left), as the fake checks it. */
export const checkDigit = (serial: string): string => {
  let sum = 0
  for (let index = 0; index < serial.length; index += 1) {
    sum += Number(serial[index]) * (index % 2 === 0 ? 1 : 3)
  }
  return String((10 - (sum % 10)) % 10)
}

export const UPLOAD_NS = "http://kabul.ptt.gov.tr"
export const TRACK_NS = "http://takip.ptt.gov.tr"
export const SOAP11 = "http://schemas.xmlsoap.org/soap/envelope/"
export const SOAP12 = "http://www.w3.org/2003/05/soap-envelope"

export const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export const envelope = (soap: string, inner: string) =>
  `<?xml version='1.0' encoding='UTF-8'?><soapenv:Envelope xmlns:soapenv="${soap}"><soapenv:Body>${inner}</soapenv:Body></soapenv:Envelope>`

/** An operation's answer as Axis2 writes it: `ns:<op>Response/ns:return`, fields under `ax21`. */
export const answer = (soap: string, ns: string, operation: string, fields: string) =>
  envelope(
    soap,
    `<ns:${operation}Response xmlns:ns="${ns}"><ns:return xmlns:ax21="${ns}/xsd">${fields}</ns:return></ns:${operation}Response>`
  )

export const fault = (soap: string) =>
  envelope(
    soap,
    soap === SOAP12
      ? "<soapenv:Fault><soapenv:Code><soapenv:Value>soapenv:Receiver</soapenv:Value></soapenv:Code><soapenv:Reason><soapenv:Text>Sunucu hatası</soapenv:Text></soapenv:Reason></soapenv:Fault>"
      : "<soapenv:Fault><faultcode>soapenv:Server</faultcode><faultstring>Sunucu hatası</faultstring></soapenv:Fault>"
  )

export const coded = (code: number, text: string) =>
  `<ax21:aciklama>${escape(text)}</ax21:aciklama><ax21:hataKodu>${String(code)}</ax21:hataKodu>`
