import type { TransportRequest, TransportResponse } from "../../../clients"
import {
  TURNSTILE_DUMMY_TOKEN,
  TURNSTILE_TEST_SECRET_FAIL,
  TURNSTILE_TEST_SECRET_PASS,
  TURNSTILE_TEST_SECRET_SPENT,
  TURNSTILE_TEST_SITE_KEY,
  createTurnstileClient,
  verifyTurnstile,
} from ".."
import type { TurnstileCheck } from ".."
import { checkTurnstileEnv, isTurnstileOff, turnstileKeys } from "../env"

// Made-up values in Cloudflare's shape, for these fakes only
const SECRET = "0x4AAAAAAAmadeUpSecretForUnitTests"
const TOKEN = "a-token-the-widget-gave"

const reply = (body: unknown, status = 200): TransportResponse => ({
  status,
  header: () => null,
  text: JSON.stringify(body),
})

function fake(...answers: (TransportResponse | Error)[]) {
  const sent: TransportRequest[] = []
  const client = createTurnstileClient({
    sleep: () => Promise.resolve(),
    transport: (request) => {
      sent.push(request)
      const next = answers.shift() ?? new Error("no more answers")
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    },
  })
  return { client, sent }
}

const check = (fields: Partial<TurnstileCheck> = {}): TurnstileCheck => ({
  token: TOKEN,
  secret: SECRET,
  gate: "login",
  remoteIp: "203.0.113.9",
  hostnames: new Set(["magaza.example", "www.magaza.example"]),
  ...fields,
})

const good = { success: true, hostname: "magaza.example", action: "login" }

describe("verifyTurnstile (adr/0044 Ek 2026-11-24)", () => {
  it("passes a token Cloudflare takes for this gate on the shop's host, sent as documented", async () => {
    const { client, sent } = fake(reply(good))

    expect(await verifyTurnstile(check(), { client })).toEqual({ ok: true })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify")
    expect(sent[0]?.method).toBe("POST")
    const body = JSON.parse(sent[0]?.body ?? "{}") as Record<string, string>
    expect(body).toMatchObject({ secret: SECRET, response: TOKEN, remoteip: "203.0.113.9" })
    expect(body["idempotency_key"]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("leaves remoteip out when the address is unknown", async () => {
    const { client, sent } = fake(reply(good))
    await verifyTurnstile(check({ remoteIp: null }), { client })
    expect(JSON.parse(sent[0]?.body ?? "{}")).not.toHaveProperty("remoteip")
  })

  it("refuses what Cloudflare refuses, with its codes", async () => {
    for (const code of ["invalid-input-response", "timeout-or-duplicate"]) {
      const { client } = fake(reply({ success: false, "error-codes": [code] }))
      expect(await verifyTurnstile(check(), { client })).toEqual({
        ok: false,
        reason: "refused",
        codes: [code],
      })
    }
  })

  it("refuses a token made for another gate or on another host", async () => {
    const other = fake(reply({ ...good, action: "newsletter" }))
    const elsewhere = fake(reply({ ...good, hostname: "kotu.example" }))
    const none = fake(reply({ success: true }))

    expect(await verifyTurnstile(check(), { client: other.client })).toMatchObject({
      reason: "action",
    })
    expect(await verifyTurnstile(check(), { client: elsewhere.client })).toMatchObject({
      reason: "hostname",
    })
    expect(await verifyTurnstile(check(), { client: none.client })).toMatchObject({
      ok: false,
      reason: "action",
    })
    // Case does not matter in a host
    const upper = fake(reply({ ...good, hostname: "WWW.Magaza.Example" }))
    expect(await verifyTurnstile(check(), { client: upper.client })).toEqual({ ok: true })
  })

  it("says nothing was asked for an empty or missing token, and refuses an overlong one unasked", async () => {
    const { client, sent } = fake()
    expect(await verifyTurnstile(check({ token: undefined }), { client })).toMatchObject({
      reason: "missing",
    })
    expect(await verifyTurnstile(check({ token: "  " }), { client })).toMatchObject({
      reason: "missing",
    })
    expect(await verifyTurnstile(check({ token: "x".repeat(2049) }), { client })).toMatchObject({
      reason: "refused",
    })
    expect(sent).toHaveLength(0)
  })

  it("is unavailable when Cloudflare cannot answer, after one retry with the same idempotency key", async () => {
    const { client, sent } = fake(new Error("timeout"), new Error("timeout"))

    expect(await verifyTurnstile(check(), { client })).toEqual({
      ok: false,
      reason: "unavailable",
      codes: [],
    })
    expect(sent).toHaveLength(2)
    expect(sent[0]?.timeoutMs).toBe(2_000)
    const keys = sent.map(
      (each) => (JSON.parse(each.body ?? "{}") as Record<string, string>)["idempotency_key"]
    )
    expect(keys[0]).toBe(keys[1])
  })

  it("is unavailable on a 5xx, a broken answer or our own secret refused, never refused", async () => {
    const down = fake(reply({}, 503), reply({}, 503))
    const broken = fake(reply("<html>"))
    const ours = fake(reply({ success: false, "error-codes": ["invalid-input-secret"] }))

    expect(await verifyTurnstile(check(), { client: down.client })).toMatchObject({
      reason: "unavailable",
    })
    expect(await verifyTurnstile(check(), { client: broken.client })).toMatchObject({
      reason: "unavailable",
    })
    expect(await verifyTurnstile(check(), { client: ours.client })).toEqual({
      ok: false,
      reason: "unavailable",
      codes: ["invalid-input-secret"],
    })
  })

  it("answers Cloudflare's test secrets offline as documented, without host or action", async () => {
    const { client, sent } = fake()
    const offline = { client, offlineTestKeys: true }
    const pass = check({ secret: TURNSTILE_TEST_SECRET_PASS, token: TURNSTILE_DUMMY_TOKEN })

    expect(await verifyTurnstile(pass, offline)).toEqual({ ok: true })
    expect(await verifyTurnstile({ ...pass, token: TOKEN }, offline)).toMatchObject({
      reason: "refused",
    })
    expect(
      await verifyTurnstile({ ...pass, secret: TURNSTILE_TEST_SECRET_FAIL }, offline)
    ).toMatchObject({ reason: "refused", codes: ["invalid-input-response"] })
    expect(
      await verifyTurnstile({ ...pass, secret: TURNSTILE_TEST_SECRET_SPENT }, offline)
    ).toMatchObject({ reason: "refused", codes: ["timeout-or-duplicate"] })
    expect(sent).toHaveLength(0)
  })

  it("takes a test secret's pass from Cloudflare without its example.com host", async () => {
    const { client } = fake(reply({ success: true, hostname: "example.com" }))
    const pass = check({ secret: TURNSTILE_TEST_SECRET_PASS, token: TURNSTILE_DUMMY_TOKEN })
    expect(await verifyTurnstile(pass, { client })).toEqual({ ok: true })
  })
})

describe("Turnstile's environment", () => {
  const issues = (env: Record<string, string | undefined>, deployed: boolean) => {
    const found: string[] = []
    checkTurnstileEnv(env, deployed, (path, message) => found.push(`${path}: ${message}`))
    return found
  }

  it("uses Cloudflare's always-pass test keys locally when unset, the env's when set", () => {
    expect(turnstileKeys({ NODE_ENV: "development" })).toEqual({
      siteKey: TURNSTILE_TEST_SITE_KEY,
      secretKey: TURNSTILE_TEST_SECRET_PASS,
    })
    expect(
      turnstileKeys({
        NODE_ENV: "test",
        TURNSTILE_SITE_KEY: "0x4AAAAsite",
        TURNSTILE_SECRET_KEY: SECRET,
      })
    ).toEqual({ siteKey: "0x4AAAAsite", secretKey: SECRET })
    expect(turnstileKeys({ NODE_ENV: "production" })).toBeNull()
  })

  it("requires both keys once deployed, never a test key, and the pair anywhere", () => {
    expect(issues({}, true)).toEqual([
      "TURNSTILE_SITE_KEY: is required in production and staging",
      "TURNSTILE_SECRET_KEY: is required in production and staging",
    ])
    expect(
      issues(
        {
          TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
          TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_PASS,
        },
        true
      )
    ).toEqual([
      "TURNSTILE_SITE_KEY: must not be a Cloudflare test key in production and staging",
      "TURNSTILE_SECRET_KEY: must not be a Cloudflare test key in production and staging",
    ])
    expect(issues({ TURNSTILE_SITE_KEY: "0x4AAAAsite" }, false)).toEqual([
      "TURNSTILE_SECRET_KEY: is required with the other Turnstile key",
    ])
    expect(issues({}, false)).toEqual([])
    expect(
      issues({ TURNSTILE_SITE_KEY: "0x4AAAAsite", TURNSTILE_SECRET_KEY: SECRET }, true)
    ).toEqual([])
  })

  it("lets a developer turn it off, nowhere else", () => {
    expect(issues({ NODE_ENV: "development", TURNSTILE: "off" }, false)).toEqual([])
    expect(issues({ NODE_ENV: "test", TURNSTILE: "off" }, false)).toEqual([])
    expect(issues({ NODE_ENV: "staging", TURNSTILE: "off" }, false)).toEqual([
      "TURNSTILE: is allowed off on development and test only",
    ])
    expect(isTurnstileOff({ NODE_ENV: "production", TURNSTILE: "off" })).toBe(false)
    expect(isTurnstileOff({ NODE_ENV: "development", TURNSTILE: "off" })).toBe(true)
  })
})
