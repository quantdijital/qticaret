/**
 * A promotion code as the shop stores and a shopper types it (ADR-0024):
 * Medusa compares codes byte for byte, so "yaz10", "Yaz10" and "YAZ10"
 * would be three codes. Every code is kept in capitals with Turkish letters
 * spelled in ASCII ("İndirim" → "INDIRIM"), and every code a shopper sends
 * is read the same way.
 */

const ASCII: Readonly<Record<string, string>> = {
  ı: "I",
  i: "I",
  İ: "I",
  ş: "S",
  Ş: "S",
  ğ: "G",
  Ğ: "G",
  ü: "U",
  Ü: "U",
  ö: "O",
  Ö: "O",
  ç: "C",
  Ç: "C",
}

export function normalizeCode(code: string): string {
  return code
    .trim()
    .replace(/[ıiİşŞğĞüÜöÖçÇ]/gu, (letter) => ASCII[letter] ?? letter)
    .toUpperCase()
}
