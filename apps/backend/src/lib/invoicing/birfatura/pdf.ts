import { ProviderError } from "../../errors"
import { parseEnv } from "../../env"
import { safeFetch } from "../../security/safe-fetch"

/**
 * Downloads the PDF of an invoice BirFatura issued, from the link its
 * `invoiceLinkUpdate` sends (adr/0072 §3.11), to keep it in the shop's
 * private store. The link is in a request's body, the token its only
 * guard: only HTTPS, only BirFatura's own hosts, under the SSRF rules
 * (`safeFetch`: public addresses checked after DNS and pinned, redirects
 * within the origin), at most 5 MB, a PDF by its first bytes. A fake
 * BirFatura on this machine (`BIRFATURA_BASE_URL`, development and tests
 * only) is reached directly.
 */

export const BIRFATURA_PROVIDER = "birfatura"
const MAX_PDF_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 15_000

/**
 * BirFatura's own hosts: its `invoiceLinkUpdate` example links
 * `https://uygulama.birfatura.com/dosyagetir?…`, its other documents
 * `test1.birfatura.com/dosyagetir`. To be narrowed to the host the first
 * test invoice shows.
 */
const ALLOWED_DOMAINS = ["birfatura.com"] as const

export function isBirfaturaPdfHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return ALLOWED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

const failure = (providerCode: string) =>
  new ProviderError({ provider: BIRFATURA_PROVIDER, providerCode, retryable: true })

async function fetchBytes(url: URL, fake: string | undefined) {
  if (fake && new URL(fake).origin === url.origin) {
    const answer = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" })
    return { status: answer.status, body: Buffer.from(await answer.arrayBuffer()) }
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !isBirfaturaPdfHost(url.hostname)
  ) {
    throw failure("pdf_url_invalid")
  }
  const answer = await safeFetch(url, {
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: MAX_PDF_BYTES,
    redirect: "same-origin",
  })
  return { status: answer.status, body: answer.body }
}

/** `fake`: the fake BirFatura's origin, reached directly (the environment's, or a test's own). */
export async function downloadBirfaturaPdf(
  address: string,
  fake: string | undefined = parseEnv().BIRFATURA_BASE_URL
): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw failure("pdf_url_invalid")
  }
  let answer
  try {
    answer = await fetchBytes(url, fake)
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error
    }
    throw new ProviderError({
      provider: BIRFATURA_PROVIDER,
      providerCode: "pdf_unreachable",
      retryable: true,
      cause: error,
    })
  }
  if (answer.status !== 200) {
    throw failure(`pdf_http_${String(answer.status)}`)
  }
  if (
    answer.body.length > MAX_PDF_BYTES ||
    answer.body.subarray(0, 5).toString("latin1") !== "%PDF-"
  ) {
    throw failure("pdf_not_pdf")
  }
  return answer.body
}
