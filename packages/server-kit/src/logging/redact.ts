import { isValidTckn } from "../tr/tax-id"

/**
 * Log redaction (docs/10, docs/04, adr/0009), applied before a line is
 * serialized so the output stays valid JSON:
 * - `redactDeep` censors values by key name at any depth (pino's own
 *   `redact` takes exact, case-sensitive paths only, so it cannot reach a
 *   provider response nested in an error's `cause`) and runs `redactText`
 *   over every string it keeps;
 * - `redactText` masks credentials and personal data inside text; the
 *   logger also runs it over the message.
 */

export const REDACTED = "[REDACTED]"

const MAX_DEPTH = 8

// Keys are compared after lowercasing and dropping separators, so
// `x-api-key`, `api_key` and `apiKey` all read `apikey`.
const SECRET_PARTS = [
  "password",
  "secret",
  "token",
  "apikey",
  "authorization",
  "cookie",
  "credential",
  "signature",
  "encryptionkey",
  "hashkey",
  "privatekey",
  "tckn",
  "taxid",
  "identitynumber",
  "cardnumber",
  "cvv",
  "cvc",
  "merchantkey",
  "merchantsalt",
  "iban",
]

// Personal data (docs/04 names TCKN, phone and address; names and postal
// codes are masked too, as the cautious reading of KVKK). `address_1`,
// `addresses`, `gsmNumber` count; references to records (`address_id`) and
// flags stay readable.
const PERSONAL_PARTS = [
  "phone",
  "gsm",
  "msisdn",
  "email",
  "address",
  "postalcode",
  "firstname",
  "lastname",
  "fullname",
  "legalname",
  "contactname",
]
const PERSONAL_EXCEPTIONS = new Set(["emailverified"])
const REFERENCE = /ids?$/

// Exact names: fields that quote request or row content (body-parser's raw
// body, pg's `detail`, query builders' SQL and bindings, a provider's own
// words about a failure, which may quote a parcel's receiver) and short secrets
const EXACT_KEYS = new Set([
  "body",
  "rawbody",
  "rawheaders",
  "detail",
  "providermessage",
  "query",
  "sql",
  "bindings",
  "parameters",
  "sessionid",
  "sid",
  "otp",
])

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "")

export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key)
  if (SECRET_PARTS.some((part) => normalized.includes(part)) || EXACT_KEYS.has(normalized)) {
    return true
  }
  return (
    PERSONAL_PARTS.some((part) => normalized.includes(part)) &&
    !REFERENCE.test(normalized) &&
    !PERSONAL_EXCEPTIONS.has(normalized)
  )
}

// Order matters: URL credentials go before e-mail, whose pattern would
// otherwise take `password@host` for an address.
// Every pattern that starts with a repeated class is anchored by a
// lookbehind, so a match is only tried where a run begins: without it a long
// run (an attacker's 16 KB path in a log line) is rescanned from each of its
// characters, which is quadratic and blocks the event loop.
const PHONE_PREFIX = String.raw`(?:(?:\+|%2B)?90[\s-]?|0)`
const PHONE_REST = String.raw`\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?![A-Za-z0-9])`
// Secrets written as `name=value` or `"name": "value"` inside text: form
// bodies, query strings, JSON kept as a string
const SECRET_NAME = String.raw`[A-Za-z0-9_-]*(?:password|passwd|secret|token|api[_-]?key|signature|merchant[_-]?(?:key|salt)|tckn|identity[_-]?number|card[_-]?number|cvv|cvc)`
const TEXT_PATTERNS: readonly (readonly [
  RegExp,
  (match: string, ...groups: string[]) => string,
])[] = [
  // A whole header line, whatever the scheme (`IYZWSv2 ...`)
  [
    /\b((?:proxy-)?authorization|cookie|set-cookie)(\s*:\s*)[^\r\n"]+/gi,
    (_match, name = "", separator = "") => `${name}${separator}${REDACTED}`,
  ],
  [
    new RegExp(
      String.raw`(?<![A-Za-z0-9_-])(${SECRET_NAME})("?\s*[:=]\s*"?)[^\s"&,;]{1,512}`,
      "gi"
    ),
    (_match, name = "", separator = "") => `${name}${separator}${REDACTED}`,
  ],
  // An OAuth answer in a query string (`/google/callback?code=…&state=…`): used once,
  // but a log keeps neither
  [/(?<=[?&](?:code|state)=)[^\s&"#]{1,2048}/g, () => REDACTED],
  // A feed's address carries its token in the path (F10.8)
  [/(?<=\/feeds\/)[A-Za-z0-9_-]{16,128}(?![A-Za-z0-9_-])/g, () => REDACTED],
  // A signed preview's token in a path (`/onizleme/…`, `/store/…/session/…`): a draft
  // entry's, product's, design link's or the theme editor's live session (adr/0065 §7)
  [
    /(?<![A-Za-z0-9])((?:sfs|sfl|cnt|prod)_)[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}(?![\w-])/g,
    (_match, kind = "") => `${kind}${REDACTED}`,
  ],
  // Authorization header values; case-sensitive so "basic shipping" stays
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/g, (_match, scheme = "") => `${scheme} ${REDACTED}`],
  [/(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g, () => REDACTED],
  // user:password@ in URLs (database, Redis, SMTP); the user may be empty
  // and the password may hold an @
  [
    /(?<![a-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/)[^\s/@:"]*:[^\s/"]*@/gi,
    (_match, scheme = "") => `${scheme}${REDACTED}@`,
  ],
  // E-mail, URL-encoded too
  [
    /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+(@|%40)([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g,
    (_match, at = "@", domain = "") => `${REDACTED}${at}${domain}`,
  ],
  // A gift card's code in the path of its lookup (ADR-0025): whoever holds
  // it spends the card, so only its last four characters are kept. The
  // balance route takes its code in the body: its name stays readable
  [
    /(\/store\/gift-cards\/)(?!balance(?![^/?#\s"]))([^/?#\s"]+)/gi,
    (_match, path = "", code = "") => `${path}${REDACTED}${code.slice(-4)}`,
  ],
  // A Medusa secret API key (F11.6, KK4): never in a log, whole or in part
  [/(?<![A-Za-z0-9])sk_[A-Za-z0-9]{16,}/g, () => REDACTED],
  // A webhook's signing secret (F11.7), should one be quoted in a message
  [/(?<![A-Za-z0-9])whsec_[0-9a-f]{16,}/gi, () => REDACTED],
  // Turkish mobiles with or without +90/0; landlines only with a prefix
  [new RegExp(String.raw`(?<![A-Za-z0-9])${PHONE_PREFIX}?5${PHONE_REST}`, "g"), () => REDACTED],
  [new RegExp(String.raw`(?<![A-Za-z0-9])${PHONE_PREFIX}[2-4]${PHONE_REST}`, "g"), () => REDACTED],
  // Only numbers that pass the TCKN check digits, so ordinary 11-digit
  // values stay readable
  [
    /(?<![A-Za-z0-9])[1-9]\d{10}(?![A-Za-z0-9])/g,
    (match) => (isValidTckn(match) ? REDACTED : match),
  ],
]

// MikroORM driver errors start with the failed statement, values included:
// `insert into "customer" (...) values (...) - duplicate key value ...`,
// also seen as `DriverException: insert into ...` when an error is
// interpolated into a string
const SQL_STATEMENT =
  /^\s*(?:\w*(?:Error|Exception):\s*)?(?:select\s[\s\S]+?\sfrom\s|insert\s+into\s|update\s+\S+\s+set\s|delete\s+from\s|with\s[\s\S]+?\sas\s)/i
const SQL_SEPARATOR = " - "

function stripSql(text: string): string {
  const separator = text.lastIndexOf(SQL_SEPARATOR)
  return separator !== -1 && SQL_STATEMENT.test(text)
    ? `[SQL] ${text.slice(separator + SQL_SEPARATOR.length)}`
    : text
}

// Bounds log volume and the work the patterns do on attacker-sized input
const MAX_TEXT_LENGTH = 8192

/** Masks credentials, personal data and a leading SQL statement in free text. */
export function redactText(text: string): string {
  // SQL first: a long statement cut short would lose the " - " that ends it
  const clean = stripSql(text)
  let result =
    clean.length > MAX_TEXT_LENGTH ? `${clean.slice(0, MAX_TEXT_LENGTH)}…[truncated]` : clean
  for (const [pattern, replacer] of TEXT_PATTERNS) {
    result = result.replace(pattern, replacer)
  }
  return result
}

// Error.isError (Node 24) also recognises errors from other realms (vm, Jest)
// where `instanceof Error` is false; the lib types predate it
const isError = (value: object): value is Error =>
  (Error as { isError?: (candidate: unknown) => boolean }).isError?.(value) ??
  value instanceof Error

const isBinary = (value: object): boolean =>
  ArrayBuffer.isView(value) || value instanceof ArrayBuffer

// `cause` and `errors` (AggregateError) are own but non-enumerable, so they
// are read explicitly; enumerable fields (pg's `detail`, a provider's
// response, MedusaError's `type`) come along and go through the same rules.
function errorFields(error: Error): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...Object.fromEntries(Object.entries(error)),
  }
  if (error.cause !== undefined) {
    fields["cause"] = error.cause
  }
  if (error instanceof AggregateError) {
    fields["errors"] = error.errors
  }
  return fields
}

// The first stack line repeats the message, SQL included; errors that a
// workflow hands back as plain objects have the same pair of fields
function withCleanStack(fields: Record<string, unknown>): Record<string, unknown> {
  const { message, stack } = fields
  if (typeof message !== "string" || typeof stack !== "string") {
    return fields
  }
  const clean = stripSql(message)
  return clean === message ? fields : { ...fields, stack: stack.replace(message, () => clean) }
}

function redactObject(value: object, depth: number, ancestors: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => walk(item, depth + 1, ancestors))
  }
  const source = withCleanStack(
    isError(value) ? errorFields(value) : Object.fromEntries(Object.entries(value))
  )
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(source)) {
    result[key] = isSensitiveKey(key) ? REDACTED : walk(item, depth + 1, ancestors)
  }
  return result
}

function walk(value: unknown, depth: number, ancestors: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactText(value)
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return isValidTckn(String(value)) ? REDACTED : value
  }
  if (typeof value !== "object" || value === null || value instanceof Date) {
    return value
  }
  if (isBinary(value)) {
    return "[Binary]"
  }
  if (ancestors.has(value)) {
    return "[Circular]"
  }
  if (depth >= MAX_DEPTH) {
    return "[Truncated]"
  }
  ancestors.add(value)
  try {
    return redactObject(value, depth, ancestors)
  } catch {
    // A throwing getter or proxy trap must not turn a log call into a failure
    return "[Unreadable]"
  } finally {
    // Only ancestors count as cycles; the same object twice side by side is fine
    ancestors.delete(value)
  }
}

/** A redacted copy of `value`, errors flattened; the input is not changed. */
export function redactDeep(value: unknown): unknown {
  return walk(value, 0, new WeakSet())
}
