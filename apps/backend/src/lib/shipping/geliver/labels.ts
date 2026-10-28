import { ProviderError } from "../../errors"
import { parseEnv } from "../../env"
import { safeFetch } from "../../security/safe-fetch"
import { GELIVER_PROVIDER } from "./errors"

/**
 * Downloads a shipment's label PDF from the address Geliver gives
 * (adr/0031), to keep it in the shop's private storage. The address is
 * Geliver's, so it is fetched under the SSRF rules; a fake Geliver on this
 * machine (`GELIVER_BASE_URL`, development and tests only) is reached
 * directly. Only a PDF of reasonable size is taken.
 */

const MAX_LABEL_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 15_000

const failure = (providerCode: string) =>
  new ProviderError({ provider: GELIVER_PROVIDER, providerCode, retryable: true })

async function fetchBytes(url: URL): Promise<{ status: number; body: Buffer }> {
  const fake = parseEnv().GELIVER_BASE_URL
  if (fake && new URL(fake).origin === url.origin) {
    const answer = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    return { status: answer.status, body: Buffer.from(await answer.arrayBuffer()) }
  }
  if (url.protocol !== "https:") {
    throw failure("label_url_invalid")
  }
  // Redirects within the origin only: a hop elsewhere could leave https with a person's label
  // (to be widened to Geliver's file hosts, by name, once a real account shows them)
  const answer = await safeFetch(url, { timeoutMs: TIMEOUT_MS, maxResponseBytes: MAX_LABEL_BYTES })
  return { status: answer.status, body: answer.body }
}

export async function downloadLabel(address: string): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw failure("label_url_invalid")
  }
  let answer
  try {
    answer = await fetchBytes(url)
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error
    }
    throw new ProviderError({
      provider: GELIVER_PROVIDER,
      providerCode: "label_unreachable",
      retryable: true,
      cause: error,
    })
  }
  if (answer.status !== 200) {
    throw failure(`label_http_${String(answer.status)}`)
  }
  if (
    answer.body.length > MAX_LABEL_BYTES ||
    answer.body.subarray(0, 5).toString("latin1") !== "%PDF-"
  ) {
    throw failure("label_not_pdf")
  }
  return answer.body
}
