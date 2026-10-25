/**
 * Text a stored field may hold: no control characters (tab only where
 * allowed) and no lone surrogates, which Postgres jsonb refuses and which
 * have no place in labels, titles or values that later reach pages,
 * structured data and headers.
 */
export function isCleanText(text: string, allowTab = false): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    const control = code < 0x20 || (code >= 0x7f && code <= 0x9f)
    const loneSurrogate = code >= 0xd800 && code <= 0xdfff
    if ((control && !(allowTab && code === 0x09)) || loneSurrogate) {
      return false
    }
  }
  return true
}
