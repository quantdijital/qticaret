/**
 * How many SMS ("boy") a text takes, as Netgsm counts it with the Turkish
 * encoding (`<encoding>TR</encoding>`): GSM 7-bit, Ş Ğ İ ı ç and the
 * extension characters two places each through the Turkish shift table;
 * anything else (an emoji) sends the message as UCS-2.
 */

const BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const EXTENSION = "^{}\\[~]|€"
const TURKISH = "ŞşĞğİıç"

export interface SmsParts {
  parts: number
  characters: number
  encoding: "GSM" | "TR" | "UCS-2"
}

export function smsParts(text: string): SmsParts {
  const chars = Array.from(text)
  if (
    chars.some(
      (char) => !BASIC.includes(char) && !EXTENSION.includes(char) && !TURKISH.includes(char)
    )
  ) {
    return {
      parts: chars.length <= 70 ? 1 : Math.ceil(chars.length / 67),
      characters: chars.length,
      encoding: "UCS-2",
    }
  }
  const septets = chars.reduce((sum, char) => sum + (BASIC.includes(char) ? 1 : 2), 0)
  const turkish = chars.some((char) => TURKISH.includes(char))
  const [single, each] = turkish ? [155, 149] : [160, 153]
  return {
    parts: septets <= single ? 1 : Math.ceil(septets / each),
    characters: chars.length,
    encoding: turkish ? "TR" : "GSM",
  }
}

/** "+90 532 *** ** 67": a number as a message log may show it. */
export function maskedNumber(number: string): string {
  const digits = number.replace(/\D/g, "").slice(-10)
  return digits.length === 10 ? `+90 ${digits.slice(0, 3)} *** ** ${digits.slice(8)}` : "***"
}
