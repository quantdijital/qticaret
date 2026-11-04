import type { MedusaRequest } from "@medusajs/framework/http"
import { forDashboard, isDashboardRequest } from "../dashboard-messages"

const BODY = { type: "invalid_data", message: "catalog.handle_required" }

function request(path: string, fields: { session?: boolean; headers?: Record<string, string> }) {
  return {
    originalUrl: path,
    headers: fields.headers ?? {},
    ...(fields.session ? { session: { auth_context: { actor_id: "user_1" } } } : {}),
  } as unknown as MedusaRequest
}

describe("isDashboardRequest", () => {
  it("sees the dashboard in a session request without Authorization", () => {
    expect(isDashboardRequest(request("/admin/products", { session: true }))).toBe(true)
  })

  it("leaves API clients, which send Authorization, alone", () => {
    const bearer = request("/admin/products", {
      session: true,
      headers: { authorization: "Bearer x" },
    })
    expect(isDashboardRequest(bearer)).toBe(false)
    expect(isDashboardRequest(request("/admin/products", {}))).toBe(false)
  })

  it("sees the login form by its origin, before a session exists", () => {
    const login = (headers: Record<string, string>) =>
      isDashboardRequest(request("/auth/user/emailpass", { headers }))
    expect(login({ origin: "http://localhost:9000" })).toBe(true)
    expect(login({})).toBe(false)
  })

  it("never applies to the store API", () => {
    const store = request("/store/carts", { session: true, headers: { origin: "https://shop.tr" } })
    expect(isDashboardRequest(store)).toBe(false)
  })
})

describe("forDashboard", () => {
  it("turns our key into the Turkish sentence and keeps the key in code", () => {
    expect(forDashboard(request("/admin/products", { session: true }), BODY)).toEqual({
      type: "invalid_data",
      code: "catalog.handle_required",
      message: "Başlıktan bir adres üretilemedi; adresi (handle) kendiniz girin.",
    })
  })

  it("puts what the error named in the sentence", () => {
    const body = forDashboard(request("/admin/legal-documents/x/draft", { session: true }), {
      type: "invalid_data",
      message: "legal.token_invalid",
      values: { tokens: "{uydurma}" },
    })
    expect(body).toMatchObject({ code: "legal.token_invalid", values: { tokens: "{uydurma}" } })
    expect(body.message).toContain("belirteç var: {uydurma}.")
  })

  it("names an untranslated key in a generic sentence", () => {
    const body = forDashboard(request("/admin/x", { session: true }), {
      type: "invalid_data",
      message: "future.unknown_key",
    })
    expect(body).toMatchObject({ code: "future.unknown_key" })
    expect(body.message).toContain("future.unknown_key")
  })

  it("leaves Medusa's own sentences and API clients' bodies as they are", () => {
    const sentence = { type: "not_found", message: "Product with id: prod_1 was not found" }
    expect(forDashboard(request("/admin/products", { session: true }), sentence)).toBe(sentence)
    expect(forDashboard(request("/admin/products", {}), BODY)).toBe(BODY)
  })
})
