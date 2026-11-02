import { expect, test } from "@playwright/test"

/**
 * The backend's refresh signal (adr/0048 Ek 2026-11-03): anything not
 * signed with the shared secret is a bare 401, never stored; other
 * methods are 405. A good signature needs the secret, which a test never
 * reads: that path is the unit tests' (`lib/refresh`).
 */

const PATH = "/api/yenile"

const body = (time: number) =>
  JSON.stringify({ scopes: ["settings"], at: time, nonce: "0123456789abcdef0123456789abcdef" })

test("a forged signal is a 401 without a word, and nothing is cached", async ({ request }) => {
  const time = Math.floor(Date.now() / 1000)
  const forged = await request.post(PATH, {
    headers: {
      "content-type": "application/json",
      "x-qt-refresh-time": String(time),
      "x-qt-refresh-signature": "0".repeat(64),
    },
    data: body(time),
    maxRedirects: 0,
  })
  expect(forged.status()).toBe(401)
  expect(forged.headers()["cache-control"]).toBe("no-store")
  expect(await forged.text()).toBe("")

  const unsigned = await request.post(PATH, { data: body(time), maxRedirects: 0 })
  expect(unsigned.status()).toBe(401)

  const big = await request.post(PATH, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ scopes: ["settings"], padding: "x".repeat(4096) }),
    maxRedirects: 0,
  })
  expect(big.status()).toBe(401)
})

test("only POST: another method is a 405, never a page or a redirect", async ({ request }) => {
  const read = await request.get(PATH, { maxRedirects: 0 })
  expect(read.status()).toBe(405)
  const put = await request.put(PATH, { data: "{}", maxRedirects: 0 })
  expect(put.status()).toBe(405)
})
