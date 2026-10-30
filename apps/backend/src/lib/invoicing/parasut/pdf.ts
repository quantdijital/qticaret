import { ProviderError } from "../../errors"
import { parseEnv } from "../../env"
import { safeFetch } from "../../security/safe-fetch"
import { PARASUT_PROVIDER } from "./oauth"

/**
 * Downloads an e-document's PDF from the link Paraşüt gives (valid for an
 * hour; Paraşüt asks that it never reach the buyer), to keep it in the
 * shop's private storage (adr/0034 §6). The link is fetched under the
 * SSRF rules over HTTPS; a fake Paraşüt on this machine
 * (`PARASUT_BASE_URL`, development and tests only) is reached directly.
 * Only a PDF of reasonable size is taken.
 */

const MAX_PDF_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 15_000

const failure = (providerCode: string) =>
  new ProviderError({ provider: PARASUT_PROVIDER, providerCode, retryable: true })

async function fetchBytes(
  url: URL,
  fake: string | undefined
): Promise<{ status: number; body: Buffer }> {
  if (fake && new URL(fake).origin === url.origin) {
    const answer = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    return { status: answer.status, body: Buffer.from(await answer.arrayBuffer()) }
  }
  if (url.protocol !== "https:") {
    throw failure("pdf_url_invalid")
  }
  // Redirects within the origin only (to be widened to Paraşüt's file hosts, by name, once
  // a real account shows them): a hop elsewhere could carry a buyer's invoice off
  const answer = await safeFetch(url, { timeoutMs: TIMEOUT_MS, maxResponseBytes: MAX_PDF_BYTES })
  return { status: answer.status, body: answer.body }
}

/** `fake`: the fake Paraşüt's origin, reached directly (the environment's, or a test's own). */
export async function downloadParasutPdf(
  address: string,
  fake: string | undefined = parseEnv().PARASUT_BASE_URL
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
      provider: PARASUT_PROVIDER,
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
