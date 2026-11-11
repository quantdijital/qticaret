/**
 * A contact's address and number as a reading role sees them (C7 review
 * M2): enough to recognise them, not to use them. Other roles, who call
 * and bill, see them in full.
 */

/** `s***@egezeytin.com.tr`: the first letter, the domain. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  return at <= 0 ? "***" : `${email.slice(0, 1)}***${email.slice(at)}`
}

/** `+90*** *** ** 63`: the country code and the last two digits of an E.164 number. */
export function maskPhone(phone: string): string {
  return phone.length < 6 ? "***" : `${phone.slice(0, 3)}*** *** ** ${phone.slice(-2)}`
}
