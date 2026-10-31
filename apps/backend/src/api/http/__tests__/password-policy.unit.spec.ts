import type { MedusaRequest } from "@medusajs/framework/http"
import { breachCheckOn, newPasswordPolicy } from "../password-policy"
import { fakeRequest, fakeResponse } from "./fakes"

const tokenNaming = (email: string) =>
  `Bearer x.${Buffer.from(JSON.stringify({ entity_id: email })).toString("base64url")}.y`

async function run(body: unknown, authorization?: string) {
  const req = {
    ...fakeRequest({ path: "/auth/customer/emailpass/register" }),
    body,
    headers: authorization ? { authorization } : {},
  } as unknown as MedusaRequest
  const next = jest.fn()
  await newPasswordPolicy(req, fakeResponse().res, next)
  const [error] = next.mock.calls[0] as [{ safeMessage?: string; field?: string } | undefined]
  return error ? { message: error.safeMessage, field: error.field } : null
}

describe("newPasswordPolicy", () => {
  it("passes a good one and leaves a missing one to Medusa", async () => {
    expect(await run({ email: "ayse@example.com", password: "mavi kuş sabah uçar" })).toBeNull()
    expect(await run({ email: "ayse@example.com" })).toBeNull()
  })

  it("names the problem on the password field", async () => {
    expect(await run({ email: "ayse@example.com", password: "kisa" })).toEqual({
      message: "auth.password_too_short",
      field: "password",
    })
    expect(await run({ email: "ayse@example.com", password: "1234567890" })).toMatchObject({
      message: "auth.password_common",
    })
  })

  it("reads a reset's address from its token", async () => {
    expect(await run({ password: "mehmetcan-1990" }, tokenNaming("mehmetcan@example.com"))).toEqual(
      { message: "auth.password_contains_email", field: "password" }
    )
  })
})

describe("breachCheckOn", () => {
  it("is on wherever a shop may be live, off only in development and tests", () => {
    expect(breachCheckOn(undefined, "production")).toBe(true)
    expect(breachCheckOn(undefined, "staging")).toBe(true)
    expect(breachCheckOn(undefined, "production ")).toBe(true)
    // Unset (empty: undefined would take the test run's own NODE_ENV) counts as live
    expect(breachCheckOn(undefined, "")).toBe(true)
    expect(breachCheckOn(undefined, "development")).toBe(false)
    expect(breachCheckOn(undefined, "test")).toBe(false)
  })

  it("reads the setting trimmed, as the environment check does", () => {
    expect(breachCheckOn("on ", "test")).toBe(true)
    expect(breachCheckOn(" off", "production")).toBe(false)
  })

  it("follows the setting over the environment", () => {
    expect(breachCheckOn("off", "production")).toBe(false)
    expect(breachCheckOn("on", "test")).toBe(true)
  })
})
