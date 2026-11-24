/**
 * Cloudflare's documented test keys
 * (developers.cloudflare.com/turnstile/troubleshooting/testing): apart from
 * the verifier, so the env schema reads them without loading the HTTP client.
 */

export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA"
export const TURNSTILE_TEST_SECRET_PASS = "1x0000000000000000000000000000000AA"
export const TURNSTILE_TEST_SECRET_FAIL = "2x0000000000000000000000000000000AA"
export const TURNSTILE_TEST_SECRET_SPENT = "3x0000000000000000000000000000000AA"
/** What a test site key's widget gives; the only token a test secret takes. */
export const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"

const TEST_SECRETS: ReadonlySet<string> = new Set([
  TURNSTILE_TEST_SECRET_PASS,
  TURNSTILE_TEST_SECRET_FAIL,
  TURNSTILE_TEST_SECRET_SPENT,
])
const TEST_SITE_KEYS: ReadonlySet<string> = new Set([
  TURNSTILE_TEST_SITE_KEY,
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
])

/** Whether a secret is one of Cloudflare's test secrets. */
export const isTurnstileTestSecret = (key: string): boolean => TEST_SECRETS.has(key)

/** Whether a key is one of Cloudflare's test keys (they pass or fail anyone: never deployed). */
export const isTurnstileTestKey = (key: string): boolean =>
  TEST_SECRETS.has(key) || TEST_SITE_KEYS.has(key)
