import { REDACTED, isSensitiveKey, redactDeep, redactText } from "../redact"

// Shaped like the backend's ProviderError (lib/errors): enumerable fields
// on top of the message, and the provider's answer in the cause chain
class ProviderError extends Error {
  override readonly name = "ProviderError"
  readonly provider: string
  readonly providerCode: string
  readonly retryable: boolean

  constructor(init: {
    provider: string
    providerCode: string
    retryable: boolean
    cause: unknown
  }) {
    super(`${init.provider} error ${init.providerCode}`, { cause: init.cause })
    this.provider = init.provider
    this.providerCode = init.providerCode
    this.retryable = init.retryable
  }
}

// Passes the TCKN check digits (tr/tax-id); not a real person's number
const VALID_TCKN = "10000000146"

describe("isSensitiveKey", () => {
  it.each([
    "authorization",
    "Authorization",
    "x-api-key",
    "apiKey",
    "api_key",
    "secretKey",
    "merchant_key",
    "merchant_salt",
    "cardNumber",
    "tckn",
    "identityNumber",
    "password",
    "newPassword",
    "token",
    "access_token",
    "refreshToken",
    "cookie",
    "set-cookie",
    "taxId",
    "tax_id_hash",
    "client_secret",
    "iban",
    "phone",
    "billing_phone",
    "email",
    "customer_email",
    "address",
    "shipping_address",
    "address_1",
    "addresses",
    "phone_number",
    "gsmNumber",
    "encryptionKey",
    "hashKey",
    "x-signature",
    "credentials",
    "detail",
    "query",
    "body",
    "rawBody",
    "first_name",
    "last_name",
    "legal_name",
    "postal_code",
    "PII_HASH_KEY",
    "sid",
    "otp",
    "x-maintenance-bypass",
  ])("treats %s as sensitive", (key) => {
    expect(isSensitiveKey(key)).toBe(true)
  })

  it.each([
    "id",
    "address_id",
    "shipping_address_id",
    "email_verified",
    "event",
    "status",
    "provider",
  ])("leaves %s readable", (key) => {
    expect(isSensitiveKey(key)).toBe(false)
  })
})

describe("redactDeep", () => {
  it("censors sensitive keys at any depth, in arrays too", () => {
    const input = {
      event: "test",
      headers: { Authorization: "Bearer abc", "x-request-id": "req-12345678" },
      items: [{ password: "p1", name: "a" }, { nested: { merchant_salt: "s" } }],
    }

    expect(redactDeep(input)).toEqual({
      event: "test",
      headers: { Authorization: REDACTED, "x-request-id": "req-12345678" },
      items: [{ password: REDACTED, name: "a" }, { nested: { merchant_salt: REDACTED } }],
    })
  })

  it("censors a whole object under a sensitive key", () => {
    expect(redactDeep({ shipping_address: { city: "İstanbul" } })).toEqual({
      shipping_address: REDACTED,
    })
  })

  it("does not change its input", () => {
    const input = { password: "p1" }

    redactDeep(input)

    expect(input.password).toBe("p1")
  })

  it("flattens errors and redacts the cause chain", () => {
    const providerResponse = {
      status: 401,
      response: { apiKey: "live-key", reason: "denied" },
      body: "raw provider text",
    }
    const error = new ProviderError({
      provider: "iyzico",
      providerCode: "1001",
      retryable: false,
      cause: new Error("upstream failed", { cause: providerResponse }),
    })

    const flat = redactDeep({ err: error }) as { err: Record<string, unknown> }

    expect(flat.err).toMatchObject({
      name: "ProviderError",
      message: "iyzico error 1001",
      provider: "iyzico",
      providerCode: "1001",
      cause: {
        name: "Error",
        message: "upstream failed",
        cause: {
          status: 401,
          response: { apiKey: REDACTED, reason: "denied" },
          body: REDACTED,
        },
      },
    })
    expect(typeof flat.err["stack"]).toBe("string")
    expect(JSON.stringify(flat)).not.toContain("live-key")
  })

  it("keeps enumerable error fields and censors database values", () => {
    const error = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      table: "customer",
      detail: "Key (email)=(ayse@example.com) already exists.",
    })

    expect(redactDeep(error)).toMatchObject({
      code: "23505",
      table: "customer",
      detail: REDACTED,
    })
  })

  it("drops the SQL statement that MikroORM puts in front of the message", () => {
    const message =
      `insert into "customer" ("email") values ('ayse@example.com') - ` +
      `duplicate key value violates unique constraint "IDX_customer_email"`
    const flat = redactDeep(new Error(message)) as { message: string; stack: string }

    expect(flat.message).toBe(
      `[SQL] duplicate key value violates unique constraint "IDX_customer_email"`
    )
    expect(flat.stack).not.toContain("ayse@example.com")
  })

  it("keeps a MedusaError's own type next to the error name", () => {
    const error = Object.assign(new Error("relation missing"), { type: "database_error" })

    expect(redactDeep(error)).toMatchObject({ name: "Error", type: "database_error" })
  })

  it("cleans SQL from errors that arrive as plain objects", () => {
    const message = `update "customer_address" set "address_1" = 'Bağdat Cad. 12' - value too long`
    const plain = { name: "Error", message, stack: `Error: ${message}\n    at step (x.js:1:1)` }

    const flat = redactDeep(plain) as { message: string; stack: string }

    expect(flat.message).toBe("[SQL] value too long")
    expect(flat.stack).not.toContain("Bağdat")
  })

  it("does not read a replacement pattern from the message into the stack", () => {
    const message = `select "x" from "y" where "z" = '$&' - invalid input syntax`

    const flat = redactDeep(new Error(message)) as { stack: string }

    expect(flat.stack).not.toContain("select")
  })

  it("masks patterns in string values, after escapes too, and keeps JSON valid", () => {
    const flat = redactDeep({
      note: `line one\nayse@example.com\t+905321234567 ${VALID_TCKN}`,
      bytes: 5368709120,
      identity: Number(VALID_TCKN),
    })
    const json = JSON.stringify(flat)

    expect(() => JSON.parse(json) as unknown).not.toThrow()
    expect(json).not.toMatch(/ayse@|5321234567|10000000146/)
    expect(flat).toMatchObject({ bytes: 5368709120, identity: REDACTED })
  })

  it("turns an unreadable object into a marker instead of throwing", () => {
    const hostile = {
      get secretless(): string {
        throw new Error("getter blew up")
      },
    }

    expect(redactDeep({ value: hostile })).toEqual({ value: "[Unreadable]" })
  })

  it("collects AggregateError members", () => {
    const error = new AggregateError([new Error("first")], "many")

    expect(redactDeep(error)).toMatchObject({ errors: [{ message: "first" }] })
  })

  it("marks cycles but not repeated references", () => {
    const shared = { value: 1 }
    const cyclic: Record<string, unknown> = { shared, again: shared }
    cyclic["self"] = cyclic

    expect(redactDeep(cyclic)).toEqual({
      shared: { value: 1 },
      again: { value: 1 },
      self: "[Circular]",
    })
  })

  it("truncates deep nesting", () => {
    let deep: Record<string, unknown> = { leaf: true }
    for (let level = 0; level < 12; level++) {
      deep = { next: deep }
    }

    expect(JSON.stringify(redactDeep(deep))).toContain("[Truncated]")
  })

  it("replaces binary data", () => {
    expect(redactDeep({ file: Buffer.from("secret bytes") })).toEqual({ file: "[Binary]" })
  })
})

describe("redactText", () => {
  it.each([
    ["Bearer token", "auth Bearer abc.def-123", `auth Bearer ${REDACTED}`],
    ["Basic credentials", "Basic dXNlcjpwYXNz", `Basic ${REDACTED}`],
    // Made up here, the shape of a real one
    ["secret API key", `key sk_${"Ab3".repeat(8)} refused`, `key ${REDACTED} refused`],
    ["webhook secret", `secret whsec_${"a1".repeat(12)}.`, `secret ${REDACTED}.`],
    [
      "JWT",
      "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl end",
      `token ${REDACTED} end`,
    ],
    [
      "URL credentials",
      "connect postgres://medusa:s3cret@db:5432/medusa failed",
      `connect postgres://${REDACTED}@db:5432/medusa failed`,
    ],
    [
      "gift card code in a lookup path",
      "GET /store/gift-cards/GIFT-ABCD-EFGH-JKLM-NPQR?fields=id 429",
      `GET /store/gift-cards/${REDACTED}NPQR?fields=id 429`,
    ],
    [
      "the balance route, whose code is in the body",
      "POST /store/gift-cards/balance 404",
      "POST /store/gift-cards/balance 404",
    ],
    [
      "e-mail",
      "Customer with email: ayse@example.com",
      `Customer with email: ${REDACTED}@example.com`,
    ],
    [
      "URL credentials without a user",
      "redis://:s3cret@10.0.0.5:6379",
      `redis://${REDACTED}@10.0.0.5:6379`,
    ],
    ["E.164 mobile", "phone +905321234567", `phone ${REDACTED}`],
    ["landline with a prefix", "tel 0212 123 45 67", `tel ${REDACTED}`],
    [
      "header line with any scheme",
      "Authorization: IYZWSv2 apiKey:abc&randomKey:1",
      `Authorization: ${REDACTED}`,
    ],
    ["cookie header", "cookie: connect.sid=s%3Aabc", `cookie: ${REDACTED}`],
    [
      "form fields",
      "merchant_key=mk1&paytr_token=pt2&amount=10",
      `merchant_key=${REDACTED}&paytr_token=${REDACTED}&amount=10`,
    ],
    [
      "JSON kept as a string",
      `{"password":"hunter2","email_ok":1}`,
      `{"password":"${REDACTED}","email_ok":1}`,
    ],
    ["URL-encoded e-mail", "q=ayse%40example.com", `q=${REDACTED}%40example.com`],
    ["URL-encoded mobile", "phone=%2B905321234567", `phone=${REDACTED}`],
    ["password holding an @", "postgres://u:p@ss@db:5432/x", `postgres://${REDACTED}@db:5432/x`],
    ["national mobile with spaces", "phone 0532 123 45 67", `phone ${REDACTED}`],
    ["TCKN", `tckn ${VALID_TCKN} given`, `tckn ${REDACTED} given`],
    [
      "Google's answer in a callback's query",
      "GET /google/callback?state=st-for-a-test&code=4/code-for-a-test 303",
      `GET /google/callback?state=${REDACTED}&code=${REDACTED} 303`,
    ],
    [
      "feed token in its address",
      "GET /feeds/feed-token-for-a-redaction-test/google 404",
      `GET /feeds/${REDACTED}/google 404`,
    ],
    [
      "theme editor's live session token in its address",
      `GET /store/storefront-layout/session/sfs_${"0a".repeat(16)}.mabc12.${"A".repeat(43)} 200`,
      `GET /store/storefront-layout/session/sfs_${REDACTED} 200`,
    ],
    [
      "design preview token in a storefront address",
      `GET /onizleme/sfl_01ABC.mabc12.${"b-".repeat(21)}c?sayfa=%2F 200`,
      `GET /onizleme/sfl_${REDACTED}?sayfa=%2F 200`,
    ],
    [
      "maintenance bypass token in its address (base64url random part)",
      `GET /store/maintenance/bypass/mnb_Ab-dEf_hIjKlMnOp.mhx0v3k0.${"A".repeat(43)} 429`,
      `GET /store/maintenance/bypass/mnb_${REDACTED} 429`,
    ],
  ])("masks a %s", (_label, input, expected) => {
    expect(redactText(input)).toBe(expected)
  })

  it.each([
    ["an 11-digit number that fails the TCKN check", "order 12345678901"],
    ["an ID with digits inside", "cus_01J9ABC5321234567XYZ"],
    ["an ISO timestamp", "2026-10-24T21:30:00.000Z"],
    ["a plain sentence", "region created"],
    ["the word basic in a sentence", "basic shipping applies"],
    ["a sentence that starts like SQL", "update failed - retrying"],
  ])("leaves %s alone", (_label, input) => {
    expect(redactText(input)).toBe(input)
  })

  it.each([
    ["letters", "a"],
    ["e-mail local-part characters", "a.b+"],
    ["URL scheme characters", "ab+c."],
    ["digits", "5"],
    ["dotted domain labels", "a."],
    ["dash-separated JWT starts", "-eyJ"],
    ["underscored secret names", "a_"],
  ])("stays linear on a long run of %s", (_label, unit) => {
    // Quadratic backtracking took seconds on 64 KB; linear takes well under a millisecond
    const input = `/store/${unit.repeat(64_000 / unit.length)}@x`
    const start = performance.now()

    redactText(input)

    expect(performance.now() - start).toBeLessThan(200)
  })

  it("strips SQL from a stack that starts with the error name", () => {
    const stack = `Error: insert into "x" ("a") values ('Ayşe') - failed\n    at y (z.js:1:1)`

    expect(redactText(stack)).toBe("[SQL] failed\n    at y (z.js:1:1)")
  })

  it("strips a long statement before cutting the text short", () => {
    const statement = `insert into "x" ("a") values ('${"Ayşe ".repeat(3000)}') - failed`

    const result = redactText(statement)

    expect(result).toBe("[SQL] failed")
  })

  it("cuts very long text", () => {
    expect(redactText("a".repeat(20_000))).toMatch(/…\[truncated\]$/)
  })
})
