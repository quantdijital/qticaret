import { REDACTED, redactText } from "../logging/redact"

/**
 * A provider's own words about a failed call (a SOAP fault's text, a
 * carrier's result message), made fit for the shop's staff to read: one
 * line of at most 160 characters, with credentials, personal data, service
 * addresses and long opaque tokens masked. The caller names the account's
 * own values a provider may quote back (its user name, password, customer
 * code); they are masked wherever they appear. Undefined when nothing
 * readable is left.
 */

export const MAX_PROVIDER_TEXT = 160
/** What stands in for a masked part, in a sentence staff read. */
export const PROVIDER_TEXT_MASK = "***"

// Provider-sized input: what is read at all before the patterns run
const MAX_RAW = 2000
// A value shorter than this is no secret worth masking ("ok", "1"), and masking it would blank words
const MIN_SECRET = 3

// Where a service is: a scheme or `www.`, a bare host under a common top-level domain, an IP address
const URL = /(?<![\p{L}\p{N}])(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s"'<>]+/giu
const HOST =
  /(?<![\p{L}\p{N}@.-])(?:[a-z0-9-]+\.)+(?:com|net|org|tr|io|info|biz|gov|edu|local|internal)(?:\.[a-z]{2})?(?::\d{1,5})?(?:\/[^\s"'<>]*)?(?![\p{L}\p{N}-])/giu
const IP = /(?<![\p{L}\p{N}.])\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?(?![\p{L}\p{N}])/gu
// An API key, a hash, a session: a long run with no space in it
const TOKEN = /(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/=_-]{24,}(?![A-Za-z0-9+/=_-])/g
const READABLE = /[\p{L}\p{N}]/u

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Control and direction-changing characters become spaces: a provider's text cannot reorder ours
function oneLine(text: string): string {
  let line = ""
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    const control = code < 0x20 || (code >= 0x7f && code <= 0x9f)
    const loneSurrogate = code >= 0xd800 && code <= 0xdfff
    const direction =
      code === 0x200e ||
      code === 0x200f ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    line += control || loneSurrogate || direction ? " " : char
  }
  return line.replace(/\s+/g, " ").trim()
}

function withoutSecrets(text: string, secrets: readonly (string | null | undefined)[]): string {
  let result = text
  const values = secrets
    .map((secret) => secret?.trim() ?? "")
    .filter((secret) => secret.length >= MIN_SECRET)
    // The longest first: a password holding the user name is masked whole
    .sort((a, b) => b.length - a.length)
  for (const secret of values) {
    result = result.replace(new RegExp(escapeRegExp(secret), "giu"), PROVIDER_TEXT_MASK)
  }
  return result
}

function shortened(text: string): string {
  const chars = Array.from(text)
  return chars.length > MAX_PROVIDER_TEXT
    ? `${chars
        .slice(0, MAX_PROVIDER_TEXT - 1)
        .join("")
        .trimEnd()}…`
    : text
}

/** The provider's text as staff may read it, or undefined. */
export function providerText(
  raw: unknown,
  secrets: readonly (string | null | undefined)[] = []
): string | undefined {
  if (typeof raw !== "string") {
    return undefined
  }
  let text = oneLine(raw.slice(0, MAX_RAW))
  text = withoutSecrets(text, secrets)
  text = redactText(text).split(REDACTED).join(PROVIDER_TEXT_MASK)
  text = text
    .replace(URL, PROVIDER_TEXT_MASK)
    .replace(HOST, PROVIDER_TEXT_MASK)
    .replace(IP, PROVIDER_TEXT_MASK)
    .replace(TOKEN, PROVIDER_TEXT_MASK)
  text = shortened(text.replace(/\s+/g, " ").trim())
  return READABLE.test(text.split(PROVIDER_TEXT_MASK).join("")) ? text : undefined
}
