/**
 * IndexNow (docs/13 §6): a page added, changed or gone is announced to
 * Bing, Yandex, Naver, Seznam and others in one call; Google does not
 * take part. The key proves the host: the storefront serves it at
 * `/{key}.txt`.
 */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org"
// The protocol takes up to 10,000 URLs per call
export const INDEXNOW_MAX_URLS = 10_000

const KEY = /^[a-f0-9]{32}$/

export const isIndexNowKey = (value: string): boolean => KEY.test(value)

export interface IndexNowPayload {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

/** The calls announcing `paths` on `host`, each URL once, 10,000 per call. */
export function indexNowPayloads(
  host: string,
  key: string,
  paths: readonly string[]
): IndexNowPayload[] {
  const origin = `https://${host}`
  const urls = [...new Set(paths.map((path) => new URL(path, origin).href))]
  const payloads: IndexNowPayload[] = []
  for (let start = 0; start < urls.length; start += INDEXNOW_MAX_URLS) {
    payloads.push({
      host,
      key,
      keyLocation: `${origin}/${key}.txt`,
      urlList: urls.slice(start, start + INDEXNOW_MAX_URLS),
    })
  }
  return payloads
}
