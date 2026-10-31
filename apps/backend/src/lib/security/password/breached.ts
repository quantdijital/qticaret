import { createHash } from "node:crypto"
import { safeFetch } from "../safe-fetch"

/**
 * Have I Been Pwned's list of breached passwords, by k-anonymity
 * (haveibeenpwned.com/API/v3#PwnedPasswords): only the first five hex
 * characters of the password's SHA-1 leave the server, the answer is
 * every known suffix under them, padded with fakes (count 0) so its size
 * tells nothing. The match is made here. No key, no account.
 */
const RANGE = "https://api.pwnedpasswords.com/range/"
const TIMEOUT_MS = 2_500
// A padded answer is about a thousand lines of 40 bytes
const MAX_BYTES = 512 * 1024

export type RangeFetch = (prefix: string) => Promise<string>

const fetchRange: RangeFetch = async (prefix) => {
  const answer = await safeFetch(`${RANGE}${prefix}`, {
    headers: { "Add-Padding": "true", "User-Agent": "quant-ticaret" },
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: MAX_BYTES,
    redirect: "error",
  })
  if (answer.status !== 200) {
    throw new Error(`pwned passwords answered ${String(answer.status)}`)
  }
  return answer.body.toString("utf8")
}

/**
 * Whether the password is in a known breach; null when the list could not
 * be asked (the caller lets the password through and logs it: an outage
 * there must not stop sign-ups here).
 */
export async function isBreached(
  password: string,
  range: RangeFetch = fetchRange
): Promise<boolean | null> {
  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase()
  let body: string
  try {
    body = await range(digest.slice(0, 5))
  } catch {
    return null
  }
  const suffix = digest.slice(5)
  for (const line of body.split("\n")) {
    const [found, count] = line.trim().split(":")
    if (found?.toUpperCase() === suffix) {
      return Number(count) > 0
    }
  }
  return false
}
