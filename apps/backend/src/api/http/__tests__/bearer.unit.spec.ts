import type { MedusaRequest } from "@medusajs/framework/http"
import { bearerTokenOf, claimsOf } from "../bearer"

const withHeader = (authorization?: string) =>
  ({ headers: authorization === undefined ? {} : { authorization } }) as unknown as MedusaRequest

const token = `x.${Buffer.from(JSON.stringify({ iat: 1, auth_identity_id: "authid_1" })).toString("base64url")}.y`

describe("bearer header", () => {
  it("reads the token as Medusa does: the word after Bearer, whatever follows", () => {
    expect(bearerTokenOf(withHeader(`Bearer ${token}`))).toBe(token)
    expect(bearerTokenOf(withHeader(`bearer   ${token} extra`))).toBe(token)
    expect(claimsOf(withHeader(`Bearer ${token} x`))).toMatchObject({ iat: 1 })
  })

  it("reads nothing from another scheme or an empty header", () => {
    expect(bearerTokenOf(withHeader("Basic abc"))).toBeNull()
    expect(bearerTokenOf(withHeader("Bearer"))).toBeNull()
    expect(bearerTokenOf(withHeader())).toBeNull()
    expect(claimsOf(withHeader("Bearer not-a-jwt"))).toBeNull()
  })
})
